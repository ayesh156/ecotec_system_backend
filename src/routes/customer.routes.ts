/**
 * Customer Routes - World-Class CRUD Operations
 * Customer management with shop isolation (single-shop mode)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { protect, authorize } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import { getShopId } from '../lib/shopId';

const router = Router();

// 🔒 All customer routes require authentication
router.use(protect);

const validateCustomer = [
  body('name').notEmpty().withMessage('Customer name is required').trim().isLength({ min: 2, max: 100 }),
  body('phone').notEmpty().withMessage('Phone number is required').trim(),
  handleValidationErrors,
];

// GET /customers - List all customers
router.get('/', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { search, page = '1', limit = '20' } = req.query;

    const where: any = { shopId };
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { nic: { contains: search, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
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

    res.json({ success: true, data: customers, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
});

// GET /customers/:id - Get single customer
router.get('/:id', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true, payments: true } } }
    });

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (customer.shopId !== shopId) return res.status(403).json({ success: false, message: 'Customer does not belong to your shop' });

    res.json({ success: true, data: customer });
  } catch (error) { next(error); }
});

// POST /customers - Create new customer
router.post('/', sensitiveRateLimiter, validateCustomer, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { name, email, phone, address, nic, customerType, creditLimit, notes } = req.body;

    const customer = await prisma.customer.create({
      data: { name, email, phone, address, nic, customerType, creditLimit: creditLimit || 0, notes, shopId },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) { next(error); }
});

// PUT /customers/:id - Update customer
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Customer does not belong to your shop' });

    const { name, email, phone, address, nic, customerType, creditLimit, creditBalance, notes, isActive } = req.body;

    const customer = await prisma.customer.update({
      where: { id },
      data: { name, email, phone, address, nic, customerType, creditLimit, creditBalance, notes },
    });

    res.json({ success: true, data: customer });
  } catch (error) { next(error); }
});

// DELETE /customers/:id - Delete customer (Admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Customer does not belong to your shop' });

    await prisma.customer.delete({ where: { id } });
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) { next(error); }
});

export default router;