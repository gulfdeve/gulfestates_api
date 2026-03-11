import express, { RequestHandler } from 'express';
import {
  createReview,
  getPropertyReviews,
  updateReview,
  deleteReview
} from '../controllers/review.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// ✅ Cast controllers to RequestHandler for Express type safety
router.post('/', protect, createReview as RequestHandler);
router.get('/property/:propertyId', getPropertyReviews as RequestHandler);
router.put('/:id', protect, updateReview as RequestHandler);
router.delete('/:id', protect, deleteReview as RequestHandler);

export default router;
