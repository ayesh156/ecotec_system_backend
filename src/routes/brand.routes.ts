/**
 * Brand Routes - Thin routing layer.
 * All business logic lives in the BrandService; handlers delegate to controllers.
 */

import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/brand.controller';

const router = Router();

// 🔒 All brand routes require authentication
router.use(protect);

const validateBrand = [
  body('name')
    .notEmpty()
    .withMessage('Brand name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Brand name must be 2-100 characters'),
  handleValidationErrors,
];

// GET /brands - List all brands
router.get('/', getAllBrands);

// GET /brands/:id - Get single brand
router.get('/:id', getBrandById);

// POST /brands - Create new brand
router.post('/', sensitiveRateLimiter, validateBrand, createBrand);

// PUT /brands/:id - Update brand
router.put('/:id', validateBrand, updateBrand);

// DELETE /brands/:id - Delete brand (Admin only)
router.delete('/:id', authorize('ADMIN'), deleteBrand);

export default router;