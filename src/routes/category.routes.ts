/**
 * Category Routes - Thin routing layer.
 * All business logic lives in the CategoryService; handlers delegate to controllers.
 */

import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';

const router = Router();

// 🔒 All category routes require authentication
router.use(protect);

// Validation middleware for category
const validateCategory = [
  body('name')
    .notEmpty()
    .withMessage('Category name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be 2-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('image')
    .optional()
    .isString()
    .withMessage('Image must be a string (URL or base64)'),
  handleValidationErrors,
];

// GET /categories - List all categories
router.get('/', getAllCategories);

// GET /categories/:id - Get single category
router.get('/:id', getCategoryById);

// POST /categories - Create new category
router.post('/', sensitiveRateLimiter, validateCategory, createCategory);

// PUT /categories/:id - Update category
router.put('/:id', validateCategory, updateCategory);

// DELETE /categories/:id - Delete category (Admin only)
router.delete('/:id', authorize('ADMIN'), deleteCategory);

export default router;