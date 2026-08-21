import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, CustomerType } from '@prisma/client';

export interface CustomerQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export class CustomerService {
  async getAll(shopId: string, params: CustomerQueryParams) {
    const { search, page = 1, limit = 20 } = params;

    // NOTE: Prisma's `mode: 'insensitive'` is only supported on PostgreSQL and
    // throws a runtime error on MySQL. MySQL's default utf8mb4_unicode_ci
    // collation already performs case-insensitive matching for `contains`,
    // so we use the plain form which works on both providers.
    const where: Prisma.CustomerWhereInput = { shopId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { nic: { contains: search } },
      ];
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.customer.count({ where }),
    ]);

    return { data: customers, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true, payments: true } } },
    });

    if (!customer) throw new AppError('Customer not found', 404);
    if (customer.shopId !== shopId) throw new AppError('Customer does not belong to your shop', 403);

    return customer;
  }

  async create(shopId: string, data: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    nic?: string;
    customerType?: CustomerType;
    creditLimit?: number;
    notes?: string;
  }) {
    const { name, email, phone, address, nic, customerType, creditLimit, notes } = data;

    return prisma.customer.create({
      data: {
        name,
        email,
        phone,
        address,
        nic,
        customerType,
        creditLimit: creditLimit !== undefined && creditLimit !== null ? new Prisma.Decimal(creditLimit.toString()) : new Prisma.Decimal(0),
        notes,
        shopId,
      },
    });
  }

  async update(shopId: string, id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    nic?: string;
    customerType?: CustomerType;
    creditLimit?: number;
    creditBalance?: number;
    notes?: string;
  }) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new AppError('Customer not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Customer does not belong to your shop', 403);

    const { name, email, phone, address, nic, customerType, creditLimit, creditBalance, notes } = data;

    return prisma.customer.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        address,
        nic,
        customerType,
        creditLimit: creditLimit !== undefined ? new Prisma.Decimal(creditLimit.toString()) : undefined,
        creditBalance: creditBalance !== undefined ? new Prisma.Decimal(creditBalance.toString()) : undefined,
        notes,
      },
    });
  }

  async remove(shopId: string, id: string) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new AppError('Customer not found', 404);
    if (existing.shopId !== shopId) throw new AppError('Customer does not belong to your shop', 403);

    await prisma.customer.delete({ where: { id } });
  }
}

export const customerService = new CustomerService();