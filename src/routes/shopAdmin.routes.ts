/**
 * Shop Admin Routes - Simplified for Single-Shop mode
 * Local user and shop administration management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { protect, authorize } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import { getShopId } from '../lib/shopId';

const router = Router();

// All shop-admin routes require ADMIN role
router.use(protect, authorize('ADMIN'));

// GET /shop-admin/users - Get all users for the default shop
router.get('/users', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const users = await prisma.user.findMany({
      where: { shopId },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
});

// PUT /shop-admin/users/:userId - Update user role/status
router.put('/users/:userId', sensitiveRateLimiter, async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { userId } = req.params;
    const { role, isActive } = req.body;

    const user = await prisma.user.findFirst({ where: { id: userId, shopId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found in this shop' });

    const validRoles = ['ADMIN', 'MANAGER', 'STAFF'];
    if (role && !validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role ?? undefined, isActive: isActive ?? undefined },
      select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
    });

    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) { next(error); }
});

// GET /shop-admin/stats - Get shop statistics
router.get('/stats', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const [usersCount, customersCount, productsCount, categoriesCount, brandsCount, invoicesCount, revenue] = await Promise.all([
      prisma.user.count({ where: { shopId } }),
      prisma.customer.count({ where: { shopId } }),
      prisma.product.count({ where: { shopId } }),
      prisma.category.count({ where: { shopId } }),
      prisma.brand.count({ where: { shopId } }),
      prisma.invoice.count({ where: { shopId } }),
      prisma.invoice.aggregate({ where: { shopId }, _sum: { paidAmount: true } }),
    ]);

    res.json({
      success: true,
      data: { users: usersCount, customers: customersCount, products: productsCount, categories: categoriesCount, brands: brandsCount, invoices: invoicesCount, totalRevenue: revenue._sum.paidAmount || 0 },
    });
  } catch (error) { next(error); }
});

export default router;