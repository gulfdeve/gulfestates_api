import { Request, Response } from 'express';
import Property from '../models/property.model.js';

// Note: Favorites functionality removed as Admin model doesn't have favorites field
// If needed, add favorites array to Admin model

// ✅ Add to Favorites (Disabled - Admin model doesn't support favorites)
export const addToFavorites = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    message: 'Favorites functionality not available for admin accounts'
  });
};

// ✅ Remove from Favorites (Disabled - Admin model doesn't support favorites)
export const removeFromFavorites = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    message: 'Favorites functionality not available for admin accounts'
  });
};

// ✅ Get All Favorites (Disabled - Admin model doesn't support favorites)
export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    message: 'Favorites functionality not available for admin accounts'
  });
};
