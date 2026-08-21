import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

const VALID_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

const validateItem = (item: any, index: number): void => {
  if (!item) throw new AppError(`Item at index ${index} is required`, 400);
  if (item.quantity === undefined || Number(item.quantity) <= 0) {
    throw new AppError(`Item at index ${index}: quantity must be greater than 0`, 400);
  }
  if (item.unitPrice === undefined || Number(item.unitPrice) < 0) {
    throw new AppError(`Item at index ${index}: unitPrice must be a non-negative number`, 400);
  }
  if (!item.description && !item.productId) {
    throw new AppError(`Item at index ${index}: description or productId is required`, 400);
  }
  if (item.discount !== undefined && (Number(item.discount) < 0 || Number(item.discount) > 100)) {
    throw new AppError(`Item at index ${index}: discount must be between 0 and 100`, 400);
  }
};

const validateEstimateNumber = (value: unknown): void => {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string' || !/^\d{10}$/.test(value)) {
      throw new AppError('Estimate number must be a 10-digit numeric string', 400);
    }
  }
};

export const validateEstimate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    if (!body.customerId) throw new AppError('customerId is required', 400);
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new AppError('At least one item is required', 400);
    }
    body.items.forEach(validateItem);
    validateEstimateNumber(body.estimateNumber);
    if (body.status && !VALID_STATUSES.includes(body.status.toUpperCase())) {
      throw new AppError('Invalid estimate status', 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateEstimateUpdate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }
      body.items.forEach(validateItem);
    }
    validateEstimateNumber(body.estimateNumber);
    if (body.status && !VALID_STATUSES.includes(body.status.toUpperCase())) {
      throw new AppError('Invalid estimate status', 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};
