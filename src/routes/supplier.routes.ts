/**
 * Supplier Routes - World-Class CRUD Operations
 * Supplier management with shop isolation (single-shop mode)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { protect, authorize } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import { getShopId } from '../lib/shopId';

const router = Router();

router.use(protect);

// GET /suppliers - List all suppliers
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
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take: limitNum }),
      prisma.supplier.count({ where }),
    ]);

    res.json({ success: true, data: suppliers, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
});

// GET /suppliers/:id - Get single supplier
router.get('/:id', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (supplier.shopId !== shopId) return res.status(403).json({ success: false, message: 'Supplier does not belong to your shop' });
    res.json({ success: true, data: supplier });
  } catch (error) { next(error); }
});

// POST /suppliers - Create new supplier
router.post('/', sensitiveRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { name, contactPerson, email, phone, address } = req.body;

    const existing = await prisma.supplier.findFirst({ where: { shopId, name: { equals: name } } });
    if (existing) return res.status(400).json({ success: false, message: 'Supplier with this name already exists' });

    const supplier = await prisma.supplier.create({ data: { shopId, name, contactPerson, email, phone, address } });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) { next(error); }
});

// PUT /suppliers/:id - Update supplier
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Supplier does not belong to your shop' });

    const { name, contactPerson, email, phone, address } = req.body;
    const supplier = await prisma.supplier.update({ where: { id }, data: { name, contactPerson, email, phone, address } });
    res.json({ success: true, data: supplier });
  } catch (error) { next(error); }
});

// DELETE /suppliers/:id - Delete supplier (Admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Supplier does not belong to your shop' });

    await prisma.supplier.delete({ where: { id } });
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) { next(error); }
});

export default router;