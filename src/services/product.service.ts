import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface ProductQueryParams {
  search?: string;
  categoryId?: string;
  brandId?: string;
  page?: number;
  limit?: number;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductStockInput {
  quantity: number;
  type: 'IN' | 'OUT';
  notes?: string;
  createdBy?: string;
}

const VALID_SORT_FIELDS = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];

export class ProductService {
  async getAll(shopId: string, params: ProductQueryParams) {
    const { search, categoryId, brandId, page = 1, limit = 20, lowStock, sortBy = 'name', sortOrder = 'asc' } = params;

    // NOTE: MySQL's utf8mb4_unicode_ci collation already performs case-insensitive
    // matching, so `mode: 'insensitive'` is not needed (and not supported on MySQL).
    const where: Prisma.ProductWhereInput = { shopId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { serialNumber: { contains: search } },
      ];
    }
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (lowStock) {
      where.stock = { lte: prisma.product.fields.lowStockThreshold };
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const sortField = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : 'name';
    const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortField]: sortOrder || 'asc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    return { data: products, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 10 },
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!product) throw new AppError('Product not found', 404);
    if (product.shopId !== shopId) throw new AppError('Product does not belong to your shop', 403);

    return product;
  }

  async create(shopId: string, data: Prisma.ProductUncheckedCreateInput) {
    const { name, description, price, costPrice, stock, lowStockThreshold, barcode, serialNumber, warranty, warrantyMonths, categoryId, brandId, image } = data;

    if (!name || price === undefined) {
      throw new AppError('Name and price are required', 400);
    }

    return prisma.product.create({
      data: {
        name,
        description,
        price: new Prisma.Decimal(price.toString()),
        costPrice: costPrice !== undefined && costPrice !== null ? new Prisma.Decimal(costPrice.toString()) : null,
        stock: stock ?? 0,
        lowStockThreshold: lowStockThreshold ?? 10,
        barcode,
        serialNumber,
        warranty,
        warrantyMonths: warrantyMonths !== undefined ? Number(warrantyMonths) : null,
        categoryId,
        brandId,
        image,
        shopId,
      },
    });
  }

  async update(shopId: string, id: string, data: Prisma.ProductUncheckedUpdateInput) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Product does not belong to your shop', 403);

    const { name, description, price, costPrice, stock, lowStockThreshold, barcode, serialNumber, warranty, warrantyMonths, categoryId, brandId, image } = data;

    return prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price !== undefined ? new Prisma.Decimal(price.toString()) : undefined,
        costPrice: costPrice !== undefined && costPrice !== null ? new Prisma.Decimal(costPrice.toString()) : costPrice === null ? null : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        lowStockThreshold,
        barcode,
        serialNumber,
        warranty,
        warrantyMonths: warrantyMonths !== undefined ? Number(warrantyMonths) : undefined,
        categoryId,
        brandId,
        image,
      },
    });
  }

  async remove(shopId: string, id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Product does not belong to your shop', 403);

    await prisma.product.delete({ where: { id } });
  }

  async adjustStock(shopId: string, id: string, input: ProductStockInput) {
    const { quantity, type, notes, createdBy } = input;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404);
    if (product.shopId !== shopId) throw new AppError('Product does not belong to your shop', 403);

    const previousStock = product.stock;
    const newStock = type === 'IN' ? previousStock + quantity : previousStock - quantity;

    if (newStock < 0) {
      throw new AppError(`Insufficient stock. Available: ${previousStock}, requested decrement: ${quantity}`, 400);
    }

    await prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id, stock: type === 'OUT' ? { gte: quantity } : undefined },
        data: { stock: newStock },
      });

      if (result.count === 0) {
        throw new AppError(`Insufficient stock. Available: ${previousStock}`, 400);
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          type: type === 'IN' ? 'GRN_IN' : 'ADJUSTMENT',
          quantity: type === 'IN' ? quantity : -quantity,
          previousStock,
          newStock,
          notes,
          shopId,
          createdBy,
        },
      });
    });

    return { previousStock, newStock };
  }
}

export const productService = new ProductService();