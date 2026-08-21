import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface BrandQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export class BrandService {
  async getAll(shopId: string, params: BrandQueryParams) {
    const { search, page = 1, limit = 50 } = params;

    const where: Prisma.BrandWhereInput = { shopId };
    if (search) {
      where.name = { contains: search };
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
        include: { _count: { select: { products: true } } },
      }),
      prisma.brand.count({ where }),
    ]);

    return { data: brands, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!brand) throw new AppError('Brand not found', 404);
    if (brand.shopId !== shopId) throw new AppError('Brand does not belong to your shop', 403);

    return brand;
  }

  async create(shopId: string, data: {
    name: string;
    description?: string;
    image?: string;
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
    isActive?: boolean;
  }) {
    const { name, description, image, website, contactEmail, contactPhone, isActive } = data;

    const existing = await prisma.brand.findFirst({ where: { shopId, name: { equals: name } } });
    if (existing) throw new AppError('A brand with this name already exists', 409);

    return prisma.brand.create({
      data: {
        name,
        description,
        image,
        website,
        contactEmail,
        contactPhone,
        isActive: isActive !== undefined ? isActive : true,
        shopId,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async update(shopId: string, id: string, data: {
    name?: string;
    description?: string;
    image?: string;
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
    isActive?: boolean;
  }) {
    const { name, description, image, website, contactEmail, contactPhone, isActive } = data;

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new AppError('Brand not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Brand does not belong to your shop', 403);

    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.brand.findFirst({ where: { shopId, name: { equals: name }, NOT: { id } } });
      if (duplicate) throw new AppError('A brand with this name already exists', 409);
    }

    return prisma.brand.update({
      where: { id },
      data: { name, description, image, website, contactEmail, contactPhone, ...(isActive !== undefined && { isActive }) },
      include: { _count: { select: { products: true } } },
    });
  }

  async remove(shopId: string, id: string) {
    const existing = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) throw new AppError('Brand not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Brand does not belong to your shop', 403);
    if (existing._count.products > 0) {
      throw new AppError(`Cannot delete brand with ${existing._count.products} products.`, 409);
    }

    await prisma.brand.delete({ where: { id } });
  }
}

export const brandService = new BrandService();