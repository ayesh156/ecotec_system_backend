import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from '../middleware/errorHandler';

// Validation error handler
const handleValidationErrors = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    throw new AppError(errorMessages, 400);
  }
  next();
};

// Quotation creation validation rules
export const validateQuotation = [
  body('customerId')
    .notEmpty()
    .withMessage('Customer ID is required')
    .isString()
    .withMessage('Customer ID must be a string'),

  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),

  body('items.*.itemType')
    .optional()
    .isIn(['PRODUCT', 'SERVICE'])
    .withMessage('Invalid item type'),

  body('items.*.productId')
    .optional()
    .isString()
    .withMessage('Product ID must be a string'),

  body('items.*.description')
    .notEmpty()
    .withMessage('Description is required for each item'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('items.*.unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),

  body('items.*.discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),

  body('quotationNumber')
    .optional()
    .isString()
    .matches(/^\d{10}$/)
    .withMessage('Quotation number must be a 10-digit numeric string'),

  body('status')
    .optional()
    .isIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'])
    .withMessage('Invalid quotation status'),

  body('discountTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount total must be a positive number'),

  body('taxTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax total must be a positive number'),

  body('validityDate')
    .optional()
    .isISO8601()
    .withMessage('Validity date must be a valid date'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),

  body('terms')
    .optional()
    .isString()
    .withMessage('Terms must be a string'),

  handleValidationErrors,
];

// Quotation update validation rules (less strict — all fields optional)
export const validateQuotationUpdate = [
  body('customerId')
    .optional()
    .isString()
    .withMessage('Customer ID must be a string'),

  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one item is required when updating items'),

  body('items.*.itemType')
    .optional()
    .isIn(['PRODUCT', 'SERVICE'])
    .withMessage('Invalid item type'),

  body('items.*.productId')
    .optional({ values: 'null' })
    .isString()
    .withMessage('Product ID must be a string when provided'),

  body('items.*.description')
    .optional()
    .notEmpty()
    .withMessage('Description is required for each item'),

  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('items.*.unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),

  body('items.*.discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),

  body('quotationNumber')
    .optional()
    .isString()
    .matches(/^\d{10}$/)
    .withMessage('Quotation number must be a 10-digit numeric string'),

  body('status')
    .optional()
    .isIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'])
    .withMessage('Invalid quotation status'),

  body('discountTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount total must be a positive number'),

  body('taxTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax total must be a positive number'),

  body('validityDate')
    .optional()
    .isISO8601()
    .withMessage('Validity date must be a valid date'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),

  body('terms')
    .optional()
    .isString()
    .withMessage('Terms must be a string'),

  handleValidationErrors,
];