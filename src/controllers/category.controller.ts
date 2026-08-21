import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import { getShopId } from '../lib/shopId';

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { search, page, limit } = req.query;

    const result = await categoryService.getAll(shopId, {
      search: typeof search === 'string' ? search : undefined,
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 50)) : undefined,
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const category = await categoryService.getById(shopId, req.params.id);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const category = await categoryService.create(shopId, req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const category = await categoryService.update(shopId, req.params.id, req.body);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await categoryService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};