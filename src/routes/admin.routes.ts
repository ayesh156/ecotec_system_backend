/**
 * Admin Routes - REMOVED in Single-Shop mode
 * Super Admin platform management is not needed in single-tenant deployment.
 * All routes previously here are now handled by shop-admin routes with DEFAULT_SHOP_ID.
 */
import { Router } from 'express';

const router = Router();

// All routes are removed in single-shop mode.
// This file is kept only to prevent import errors in index.ts.
// The import from index.ts should be removed.

export default router;