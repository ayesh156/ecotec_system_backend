import { Request, Response, NextFunction } from 'express';
import { quotationService, generateQuotationNumber } from '../services/quotation.service';
import { toJSON } from '../lib/serializer';
import { getShopId } from '../lib/shopId';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types/express';

// GET /api/v1/quotations/next-number
export const getNextQuotationNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    if (!shopId) throw new AppError('User is not associated with any shop', 403);
    const number = await generateQuotationNumber(shopId);
    res.json({ success: true, data: { number } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations
export const getAllQuotations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { page, limit, status, customerId, startDate, endDate, search, sortBy, sortOrder } = req.query;

    const result = await quotationService.getAll(shopId, {
      page: page ? Math.max(1, parseInt(page as string) || 1) : undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 10)) : undefined,
      status: typeof status === 'string' ? status : undefined,
      customerId: typeof customerId === 'string' ? customerId : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      search: typeof search === 'string' ? search : undefined,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: (sortOrder as 'asc' | 'desc') || undefined,
    });

    res.json({
      success: true,
      data: toJSON(result.data),
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations/:id
export const getQuotationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const quotation = await quotationService.getById(shopId, req.params.id);
    res.json({ success: true, data: toJSON(quotation) });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/quotations
export const createQuotation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const quotation = await quotationService.create(shopId, req.user?.id, req.body);
    res.status(201).json({ success: true, message: 'Quotation created successfully', data: toJSON(quotation) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/quotations/:id
export const updateQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const quotation = await quotationService.update(shopId, req.params.id, req.body);
    res.json({ success: true, message: 'Quotation updated successfully', data: toJSON(quotation) });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/quotations/:id
export const deleteQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    await quotationService.remove(shopId, req.params.id);
    res.json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/quotations/:id/convert-to-invoice
export const convertQuotationToInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const result = await quotationService.convertToInvoice(shopId, req.user?.id, req.params.id);

    res.status(201).json({
      success: true,
      message: 'Quotation converted to invoice successfully',
      data: toJSON({ invoice: result.invoice, quotation: result.quotation }),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations/stats
export const getQuotationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const data = await quotationService.getStats(shopId);
    res.json({ success: true, data: toJSON(data) });
  } catch (error) {
    next(error);
  }
};