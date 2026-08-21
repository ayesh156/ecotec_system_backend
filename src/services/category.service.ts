import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface CategoryQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export class CategoryService {
  async getAll(shopId: string, params: CategoryQueryParams) {
    const { search, page = 1, limit = 50 } = params;

    const where: Prisma.CategoryWhereInput = { shopId };
    if (search) {
      where.name = { contains: search };
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
        include: { _count: { select: { products: true } } },
      }),
      prisma.category.count({ where }),
    ]);

    return { data: categories, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) throw new AppError('Category not found', 404);
    if (category.shopId !== shopId) throw new AppError('Category does not belong to your shop', 403);

    return category;
  }

  async create(shopId: string, data: { name: string; description?: string; image?: string; isActive?: boolean }) {
    const { name, description, image, isActive } = data;

    // Check for duplicate name in same shop
    const existing = await prisma.category.findFirst({ where: { shopId, name: { equals: name } } });
    if (existing) throw new AppError('A category with this name already exists', 409);

    return prisma.category.create({
      data: {
        name,
        description,
        image,
        isActive: isActive !== undefined ? isActive : true,
        shopId,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async update(shopId: string, id: string, data: { name?: string; description?: string; image?: string; isActive?: boolean }) {
    const { name, description, image, isActive } = data;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new AppError('Category not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Category does not belong to your shop', 403);

    // Check for duplicate name (excluding current category)
    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.category.findFirst({ where: { shopId, name: { equals: name }, NOT: { id } } });
      if (duplicate) throw new AppError('A category with this name already exists', 409);
    }

    return prisma.category.update({
      where: { id },
      data: { name, description, image, ...(isActive !== undefined && { isActive }) },
      include: { _count: { select: { products: true } } },
    });
  }

  async remove(shopId: string, id: string) {
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) throw new AppError('Category not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Category does not belong to your shop', 403);

    // Check if category has products
    if (existing._count.products > 0) {
      throw new AppError(`Cannot delete category with ${existing._count.products} products. Reassign products first.`, 409);
    }

    await prisma.category.delete({ where: { id } });
  }
}

export const categoryService = new CategoryService();