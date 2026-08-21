import { Request, Response, NextFunction } from 'express';
import { brandService } from '../services/brand.service';
import { getShopId } from '../lib/shopId';

export const getAllBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { search, page, limit } = req.query;

    const result = await brandService.getAll(shopId, {
      search: typeof search === 'string' ? search : undefined,
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 50)) : undefined,
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const brand = await brandService.getById(shopId, req.params.id);
    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const brand = await brandService.create(shopId, req.body);
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const brand = await brandService.update(shopId, req.params.id, req.body);
    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await brandService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
};