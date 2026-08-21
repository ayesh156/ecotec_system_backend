import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { getShopId } from '../lib/shopId';
import { AuthRequest } from '../types/express';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { search, categoryId, brandId, page, limit, lowStock, sortBy, sortOrder } = req.query;

    const result = await productService.getAll(shopId, {
      search: typeof search === 'string' ? search : undefined,
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      brandId: typeof brandId === 'string' ? brandId : undefined,
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 20)) : undefined,
      lowStock: lowStock === 'true',
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: (sortOrder as 'asc' | 'desc') || undefined,
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const product = await productService.getById(shopId, req.params.id);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const product = await productService.create(shopId, req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const product = await productService.update(shopId, req.params.id, req.body);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await productService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateProductStock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { quantity, type, notes } = req.body;
    const result = await productService.adjustStock(shopId, req.params.id, {
      quantity: Number(quantity),
      type: type === 'IN' ? 'IN' : 'OUT',
      notes,
      createdBy: req.user?.id,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};