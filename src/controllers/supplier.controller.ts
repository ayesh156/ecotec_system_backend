import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../types/express';
import { getShopId } from '../lib/shopId';

// Create a new supplier
export const createSupplier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { name, contactPerson, email, phone, address } = req.body;

    const existing = await prisma.supplier.findFirst({
      where: { shopId, name: { equals: name } }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Supplier with this name already exists' });
    }

    const supplier = await prisma.supplier.create({
      data: { shopId, name, contactPerson, email, phone, address }
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// Get all suppliers for the shop
export const getSuppliers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const suppliers = await prisma.supplier.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        grns: {
          where: { status: { in: ['COMPLETED', 'PENDING'] } },
          select: { totalAmount: true, createdAt: true }
        },
        _count: { select: { grns: true } }
      }
    });

    const suppliersWithTotals = suppliers.map(supplier => {
      const totalPurchases = supplier.grns.reduce((sum, grn) => sum + (grn.totalAmount || 0), 0);
      const lastOrder = supplier.grns.length > 0
        ? supplier.grns.reduce((latest, grn) =>
            new Date(grn.createdAt) > new Date(latest.createdAt) ? grn : latest
          ).createdAt
        : null;

      return {
        ...supplier,
        totalPurchases,
        totalOrders: supplier._count.grns,
        lastOrder,
        grns: undefined
      };
    });

    res.json({ success: true, data: suppliersWithTotals });
  } catch (error) {
    next(error);
  }
};

// Get single supplier
export const getSupplierById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { grns: { orderBy: { createdAt: 'desc' }, take: 5 } }
    });

    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (supplier.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// Update supplier
export const updateSupplier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { name, contactPerson, email, phone, address, isActive } = req.body;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, contactPerson, email, phone, address, isActive }
    });

    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// Delete supplier (hard delete if no GRNs, soft delete otherwise)
export const deleteSupplier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { grns: true } } }
    });

    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    if (existing._count.grns > 0) {
      await prisma.supplier.update({ where: { id }, data: { isActive: false } });
      return res.json({ success: true, message: 'Supplier deactivated (has existing GRNs)' });
    }

    await prisma.supplier.delete({ where: { id } });
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
};