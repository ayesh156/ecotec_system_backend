import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplier.service';
import { getShopId } from '../lib/shopId';

export const getAllSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { search, page, limit } = req.query;

    const result = await supplierService.getAll(shopId, {
      search: typeof search === 'string' ? search : undefined,
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 20)) : undefined,
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const supplier = await supplierService.getById(shopId, req.params.id);
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const supplier = await supplierService.create(shopId, req.body);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const supplier = await supplierService.update(shopId, req.params.id, req.body);
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await supplierService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
};