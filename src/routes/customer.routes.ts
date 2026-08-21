/**
 * Customer Routes - Thin routing layer.
 * All business logic lives in the CustomerService; handlers delegate to controllers.
 */

import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller';

const router = Router();

// 🔒 All customer routes require authentication
router.use(protect);

const validateCustomer = [
  body('name').notEmpty().withMessage('Customer name is required').trim().isLength({ min: 2, max: 100 }),
  body('phone').notEmpty().withMessage('Phone number is required').trim(),
  handleValidationErrors,
];

// GET /customers - List all customers
router.get('/', getAllCustomers);

// GET /customers/:id - Get single customer
router.get('/:id', getCustomerById);

// POST /customers - Create new customer
router.post('/', sensitiveRateLimiter, validateCustomer, createCustomer);

// PUT /customers/:id - Update customer
router.put('/:id', updateCustomer);

// DELETE /customers/:id - Delete customer (Admin only)
router.delete('/:id', authorize('ADMIN'), deleteCustomer);

export default router;