/**
 * Product Routes - World-Class CRUD Operations
 * Product management with shop isolation (single-shop mode)
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

router.use(protect);

// GET /products - List all products with filtering and pagination
router.get('/', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { search, categoryId, brandId, page = '1', limit = '20', lowStock, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const where: any = { shopId };
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (lowStock === 'true') where.stock = { lte: prisma.product.fields.lowStockThreshold };

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const validSortFields = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];
    const orderBy: any = {};
    orderBy[validSortFields.includes(sortBy as string) ? (sortBy as string) : 'name'] = (sortOrder as 'asc' | 'desc') || 'asc';

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

    res.json({ success: true, data: products, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
});

// GET /products/:id - Get single product
router.get('/:id', async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, brand: true, stockMovements: { orderBy: { createdAt: 'desc' }, take: 10 }, priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 } }
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.shopId !== shopId) return res.status(403).json({ success: false, message: 'Product does not belong to your shop' });

    res.json({ success: true, data: product });
  } catch (error) { next(error); }
});

// POST /products - Create new product
router.post('/', sensitiveRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { name, description, price, costPrice, stock, lowStockThreshold, barcode, serialNumber, warranty, warrantyMonths, categoryId, brandId, image } = req.body;

    if (!name || price === undefined) return res.status(400).json({ success: false, message: 'Name and price are required' });

    const product = await prisma.product.create({
      data: { name, description, price: parseFloat(price), costPrice: costPrice ? parseFloat(costPrice) : null, stock: stock || 0, lowStockThreshold: lowStockThreshold || 10, barcode, serialNumber, warranty, warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null, categoryId, brandId, image, shopId },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) { next(error); }
});

// PUT /products/:id - Update product
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Product does not belong to your shop' });

    const { name, description, price, costPrice, stock, lowStockThreshold, barcode, serialNumber, warranty, warrantyMonths, categoryId, brandId, image } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: { name, description, price: price !== undefined ? parseFloat(price) : undefined, costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined, stock: stock !== undefined ? stock : undefined, lowStockThreshold, barcode, serialNumber, warranty, warrantyMonths: warrantyMonths !== undefined ? parseInt(warrantyMonths) : undefined, categoryId, brandId, image },
    });

    res.json({ success: true, data: product });
  } catch (error) { next(error); }
});

// DELETE /products/:id - Delete product (Admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Product does not belong to your shop' });

    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) { next(error); }
});

// POST /products/:id/stock - Update stock (Admin/Manager)
router.post('/:id/stock', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { quantity, type, notes } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.shopId !== shopId) return res.status(403).json({ success: false, message: 'Product does not belong to your shop' });

    const previousStock = product.stock;
    const newStock = type === 'IN' ? previousStock + quantity : previousStock - quantity;

    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { stock: newStock } });
      await tx.stockMovement.create({
        data: { productId: id, type: type === 'IN' ? 'GRN_IN' : 'ADJUSTMENT', quantity: type === 'IN' ? quantity : -quantity, previousStock, newStock, notes, shopId, createdBy: (req as any).user?.id }
      });
    });

    res.json({ success: true, data: { previousStock, newStock } });
  } catch (error) { next(error); }
});

export default router;