import express from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getSimilarProperties,
  getFeaturedProperties,
  bulkCreateProperties,
  getPropertyCounts,
} from '../controllers/property.controller.js';
import { protect, restrictToAdmin } from '../middleware/auth.middleware.js';
import { propertyRateLimiter } from '../middleware/rateLimiter.middleware.js';
import { uploadPropertyFiles } from '../utils/multerCloudinary.js';

const router = express.Router();

// Public routes - Rate limited: 100 requests per hour per IP (admins excluded)
router.get('/', propertyRateLimiter, getAllProperties);
router.get('/featured', propertyRateLimiter, getFeaturedProperties);
router.get('/counts', propertyRateLimiter, getPropertyCounts);
router.get('/:id', propertyRateLimiter, getPropertyById);
router.get('/:id/similar', propertyRateLimiter, getSimilarProperties);

// Property routes with file uploads (images + PDF brochure streamed directly to Cloudinary)
router.post('/', protect, restrictToAdmin, uploadPropertyFiles.any(), createProperty);
router.put('/:id', protect, restrictToAdmin, uploadPropertyFiles.any(), updateProperty);

// Other routes
router.post('/bulk', protect, restrictToAdmin, bulkCreateProperties);
router.delete('/:id', protect, restrictToAdmin, deleteProperty);

export default router;