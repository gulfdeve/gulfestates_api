import express from 'express';
import {
  getDashboardStats,
  getPropertyAnalytics,
  getAdminActivity,
  getMarketingAnalytics,
  getLanguageSpecificCounts
} from '../controllers/analytics.controller.js';
import { protect, restrictToAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/dashboard', protect, restrictToAdmin, getDashboardStats);
router.get('/properties', protect, restrictToAdmin, getPropertyAnalytics);
router.get('/activity', protect, restrictToAdmin, getAdminActivity);
router.get('/marketing', protect, restrictToAdmin, getMarketingAnalytics);
router.get('/language-counts', protect, restrictToAdmin, getLanguageSpecificCounts);

export default router;