import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface SupplierQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export class SupplierService {
  async getAll(shopId: string, params: SupplierQueryParams) {
    const { search, page = 1, limit = 20 } = params;

    const where: Prisma.SupplierWhereInput = { shopId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take: limitNum }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier) throw new AppError('Supplier not found', 404);
    if (supplier.shopId !== shopId) throw new AppError('Supplier does not belong to your shop', 403);

    return supplier;
  }

  async create(shopId: string, data: {
    name: string;
    contactPerson?: string;
    email?: string;
    phone: string;
    address?: string;
  }) {
    const { name, contactPerson, email, phone, address } = data;

    const existing = await prisma.supplier.findFirst({ where: { shopId, name: { equals: name } } });
    if (existing) throw new AppError('Supplier with this name already exists', 400);

    return prisma.supplier.create({ data: { shopId, name, contactPerson, email, phone, address } });
  }

  async update(shopId: string, id: string, data: {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    const { name, contactPerson, email, phone, address } = data;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new AppError('Supplier not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Supplier does not belong to your shop', 403);

    return prisma.supplier.update({ where: { id }, data: { name, contactPerson, email, phone, address } });
  }

  async remove(shopId: string, id: string) {
    const existing = await prisma.supplier.findUnique({ where: { id } });

    if (!existing) throw new AppError('Supplier not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Supplier does not belong to your shop', 403);

    await prisma.supplier.delete({ where: { id } });
  }
}

export const supplierService = new SupplierService();