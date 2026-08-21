import { Request, Response, NextFunction } from 'express';
import { customerService } from '../services/customer.service';
import { getShopId } from '../lib/shopId';

export const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { search, page, limit } = req.query;

    const result = await customerService.getAll(shopId, {
      search: typeof search === 'string' ? search : undefined,
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 20)) : undefined,
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const customer = await customerService.getById(shopId, req.params.id);
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const customer = await customerService.create(shopId, req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const customer = await customerService.update(shopId, req.params.id, req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await customerService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};