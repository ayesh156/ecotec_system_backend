/**
 * Shop Routes - Simplified for Single-Shop mode
 * Shop profile settings and local user management only.
 * Multi-shop registration, listing, and super-admin endpoints are removed.
 */

import { Router } from 'express';
import {
  getShopById,
  updateShop,
  getShopUsers,
  addShopUser,
  updateUserRole,
  getShopStats,
  getShopSections,
  updateShopSections,
  debugShopSections,
} from '../controllers/shop.controller';
import { protect, authorize } from '../middleware/auth';
import { getShopId } from '../lib/shopId';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ==========================================
// AUTHENTICATED ROUTES
// ==========================================

// Get the default shop by ID
router.get('/current', protect, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return getShopById(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Update shop settings (admin only)
router.put('/current', protect, authorize('ADMIN'), sensitiveRateLimiter, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return updateShop(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Get shop statistics
router.get('/current/stats', protect, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return getShopStats(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// USER MANAGEMENT (admin only)
// ==========================================

// Get all users in shop
router.get('/current/users', protect, authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return getShopUsers(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Add new user to shop
router.post('/current/users', protect, authorize('ADMIN'), sensitiveRateLimiter, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return addShopUser(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Update user role/status
router.put('/current/users/:userId', protect, authorize('ADMIN'), sensitiveRateLimiter, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return updateUserRole(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SECTION VISIBILITY
// ==========================================

// Get hidden sections
router.get('/current/sections', protect, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return getShopSections(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Update hidden sections (Admin)
router.put('/current/sections', protect, authorize('ADMIN'), sensitiveRateLimiter, async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return updateShopSections(req, res, next);
  } catch (error) {
    next(error);
  }
});

// DEBUG: Shop sections diagnostic
router.get('/current/debug/sections', protect, authorize('ADMIN'), async (req, res, next) => {
  try {
    const shopId = getShopId();
    req.params.id = shopId;
    return debugShopSections(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;