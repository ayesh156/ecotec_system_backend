/**
 * Public Routes - Accessible without authentication
 * Used by the public-facing website to display products, categories, and brands
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { getShopId } from '../lib/shopId';

const router = Router();

// ==========================================
// GET /public/products - List products for public website
// ==========================================
router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopId: shopIdParam, shopSlug, search, categoryId, brandId, page = '1', limit = '50', sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Resolve the target shop: prefer explicit shopId/shopSlug query params,
    // otherwise fall back to the default shop record so the storefront is never empty.
    let targetShopId: string;
    if (shopIdParam && typeof shopIdParam === 'string') {
      targetShopId = shopIdParam;
    } else if (shopSlug && typeof shopSlug === 'string') {
      const shopBySlug = await prisma.shop.findFirst({ where: { slug: shopSlug } });
      if (!shopBySlug) {
        return res.status(404).json({ success: false, message: 'Shop not found' });
      }
      targetShopId = shopBySlug.id;
    } else {
      const defaultShop = await prisma.shop.findFirst();
      targetShopId = defaultShop?.id ?? getShopId();
    }

    // Return all products for the shop so newly added products
    // appear immediately on the public storefront.
    const where: any = { 
      shopId: targetShopId,
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const validSortFields = ['name', 'price', 'stock', 'createdAt'];
    const orderBy: any = {};
    orderBy[validSortFields.includes(sortBy as string) ? (sortBy as string) : 'name'] = (sortOrder as 'asc' | 'desc') || 'asc';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { 
          category: { select: { id: true, name: true } }, 
          brand: { select: { id: true, name: true } } 
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ 
      success: true, 
      data: products, 
      pagination: { 
        page: pageNum, 
        limit: limitNum, 
        total, 
        totalPages: Math.ceil(total / limitNum) 
      } 
    });
  } catch (error) { 
    next(error); 
  }
});

// ==========================================
// GET /public/products/:id - Get single product for public website
// ==========================================
router.get('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { 
        category: { select: { id: true, name: true } }, 
        brand: { select: { id: true, name: true } } 
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /public/categories - List categories for public website
// ==========================================
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();

    const categories = await prisma.category.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } }
      }
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /public/brands - List brands for public website
// ==========================================
router.get('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();

    const brands = await prisma.brand.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } }
      }
    });

    res.json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
});

export default router;
