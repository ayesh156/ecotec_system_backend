import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToInvoice,
  getQuotationStats,
  getNextQuotationNumber,
} from '../controllers/quotation.controller';
import { validateQuotation, validateQuotationUpdate } from '../validators/quotation.validator';

const router = Router();

// All quotation routes require authentication
router.use(protect);

// Quotation CRUD routes
// NOTE: /stats must be registered BEFORE /:id to avoid route conflicts
router.route('/stats')
  .get(getQuotationStats);

router.route('/next-number')
  .get(getNextQuotationNumber);

router.route('/')
  .get(getAllQuotations)
  .post(validateQuotation, createQuotation);

// Convert accepted quotation to invoice
router.route('/:id/convert-to-invoice')
  .post(convertQuotationToInvoice);

router.route('/:id')
  .get(getQuotationById)
  .put(validateQuotationUpdate, updateQuotation)
  .delete(deleteQuotation);

export default router;