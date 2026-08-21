import { Request, Response, NextFunction } from 'express';
import { estimateService, generateEstimateNumber } from '../services/estimate.service';
import { toJSON } from '../lib/serializer';
import { getShopId } from '../lib/shopId';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types/express';

export const getNextEstimateNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    if (!shopId) throw new AppError('User is not associated with any shop', 403);
    const number = await generateEstimateNumber(shopId);
    res.json({ success: true, data: { number } });
  } catch (error) { next(error); }
};

export const getAllEstimates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const result = await estimateService.getAll(shopId, {
      page: req.query.page ? Math.max(1, parseInt(req.query.page as string) || 1) : undefined,
      limit: req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10)) : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || undefined,
    });
    res.json({ success: true, data: toJSON(result.data), pagination: result.pagination });
  } catch (error) { next(error); }
};

export const getEstimateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimate = await estimateService.getById(getShopId(), req.params.id);
    res.json({ success: true, data: toJSON(estimate) });
  } catch (error) { next(error); }
};

export const createEstimate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const estimate = await estimateService.create(getShopId(), req.user?.id, req.body);
    res.status(201).json({ success: true, message: 'Estimate created successfully', data: toJSON(estimate) });
  } catch (error) { next(error); }
};

export const updateEstimate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimate = await estimateService.update(getShopId(), req.params.id, req.body);
    res.json({ success: true, message: 'Estimate updated successfully', data: toJSON(estimate) });
  } catch (error) { next(error); }
};

export const deleteEstimate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await estimateService.remove(getShopId(), req.params.id);
    res.json({ success: true, message: 'Estimate deleted successfully' });
  } catch (error) { next(error); }
};

export const convertEstimateToQuotation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await estimateService.convertToQuotation(getShopId(), req.user?.id, req.params.id);
    res.status(201).json({ success: true, message: 'Estimate converted to quotation successfully', data: toJSON(result) });
  } catch (error) { next(error); }
};

export const convertEstimateToInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await estimateService.convertToInvoice(getShopId(), req.user?.id, req.params.id);
    res.status(201).json({ success: true, message: 'Estimate converted to invoice successfully', data: toJSON(result) });
  } catch (error) { next(error); }
};

export const getEstimateStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await estimateService.getStats(getShopId());
    res.json({ success: true, data: toJSON(data) });
  } catch (error) { next(error); }
};