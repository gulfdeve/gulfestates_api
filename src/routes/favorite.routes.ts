import express, { RequestHandler } from 'express';
import {
  addToFavorites,
  removeFromFavorites,
  getFavorites
} from '../controllers/favorite.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// ✅ Cast controllers as RequestHandler to satisfy Express' TS definitions
router.get('/', protect, getFavorites as RequestHandler);
router.post('/', protect, addToFavorites as RequestHandler);
router.delete('/:propertyId', protect, removeFromFavorites as RequestHandler);

export default router;
