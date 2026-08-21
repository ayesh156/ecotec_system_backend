import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getAllEstimates,
  getEstimateById,
  createEstimate,
  updateEstimate,
  deleteEstimate,
  convertEstimateToQuotation,
  convertEstimateToInvoice,
  getEstimateStats,
  getNextEstimateNumber,
} from '../controllers/estimate.controller';
import { validateEstimate, validateEstimateUpdate } from '../validators/estimate.validator';

const router = Router();

// All estimate routes require authentication
router.use(protect);

// Stats & next-number must be registered BEFORE /:id to avoid route conflicts
router.route('/stats')
  .get(getEstimateStats);

router.route('/next-number')
  .get(getNextEstimateNumber);

router.route('/')
  .get(getAllEstimates)
  .post(validateEstimate, createEstimate);

// Convert accepted estimate to quotation or invoice
router.route('/:id/convert-to-quotation')
  .post(convertEstimateToQuotation);

router.route('/:id/convert-to-invoice')
  .post(convertEstimateToInvoice);

router.route('/:id')
  .get(getEstimateById)
  .put(validateEstimateUpdate, updateEstimate)
  .delete(deleteEstimate);

export default router;