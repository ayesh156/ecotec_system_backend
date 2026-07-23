/**
 * Brand Routes - World-Class CRUD Operations
 * Brand management with shop isolation (single-shop mode)
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

// 🔒 All brand routes require authentication
router.use(protect);

const validateBrand = [
  body('name')
    .notEmpty()
    .withMessage('Brand name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Brand name must be 2-100 characters'),
  handleValidationErrors,
];

// GET /brands - List all brands
router.get('/', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { search, page = '1', limit = '50' } = req.query;

    const where: any = { shopId };
    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
        include: { _count: { select: { products: true } } }
      }),
      prisma.brand.count({ where }),
    ]);

    res.json({ success: true, data: brands, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    next(error);
  }
});

// GET /brands/:id - Get single brand
router.get('/:id', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } }
    });

    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    if (brand.shopId !== shopId) return res.status(403).json({ success: false, message: 'Brand does not belong to your shop' });

    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
});

// POST /brands - Create new brand
router.post('/', sensitiveRateLimiter, validateBrand, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { name, description, image, website, contactEmail, contactPhone, isActive } = req.body;

    const existing = await prisma.brand.findFirst({ where: { shopId, name: { equals: name } } });
    if (existing) return res.status(409).json({ success: false, message: 'A brand with this name already exists' });

    const brand = await prisma.brand.create({
      data: { name, description, image, website, contactEmail, contactPhone, isActive: isActive !== undefined ? isActive : true, shopId },
      include: { _count: { select: { products: true } } }
    });

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
});

// PUT /brands/:id - Update brand
router.put('/:id', validateBrand, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Brand not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Brand does not belong to your shop' });

    const { name, description, image, website, contactEmail, contactPhone, isActive } = req.body;

    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.brand.findFirst({ where: { shopId, name: { equals: name }, NOT: { id } } });
      if (duplicate) return res.status(409).json({ success: false, message: 'A brand with this name already exists' });
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: { name, description, image, website, contactEmail, contactPhone, ...(isActive !== undefined && { isActive }) },
      include: { _count: { select: { products: true } } }
    });

    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
});

// DELETE /brands/:id - Delete brand (Admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!existing) return res.status(404).json({ success: false, message: 'Brand not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Brand does not belong to your shop' });
    if (existing._count.products > 0) return res.status(409).json({ success: false, message: `Cannot delete brand with ${existing._count.products} products.` });

    await prisma.brand.delete({ where: { id } });
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;