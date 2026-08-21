/**
 * Supplier Routes - Thin routing layer.
 * All business logic lives in the SupplierService; handlers delegate to controllers.
 */

import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller';

const router = Router();

// 🔒 All supplier routes require authentication
router.use(protect);

// GET /suppliers - List all suppliers
router.get('/', getAllSuppliers);

// GET /suppliers/:id - Get single supplier
router.get('/:id', getSupplierById);

// POST /suppliers - Create new supplier
router.post('/', sensitiveRateLimiter, createSupplier);

// PUT /suppliers/:id - Update supplier
router.put('/:id', updateSupplier);

// DELETE /suppliers/:id - Delete supplier (Admin only)
router.delete('/:id', authorize('ADMIN'), deleteSupplier);

export default router;