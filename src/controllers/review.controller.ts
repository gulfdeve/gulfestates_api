import { Request, Response } from 'express';
import { Review } from '../models/review.model.js';

// ✅ Create Review
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { property, rating, comment } = req.body;

    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check for duplicate review by same user
    const existingReview = await Review.findOne({ property, user: req.user.id });
    if (existingReview) {
      res.status(400).json({
        success: false,
        message: 'You have already reviewed this property'
      });
      return;
    }

    const review = await Review.create({
      property,
      user: req.user.id,
      rating,
      comment
    });

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: { review: populatedReview }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
};

// ✅ Get Property Reviews
export const getPropertyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;

    const reviews = await Review.find({ property: propertyId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        reviews,
        count: reviews.length,
        avgRating: parseFloat(avgRating.toFixed(1))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// ✅ Update Review
export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    let review = await Review.findById(id);
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (review.user.toString() !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
      return;
    }

    review = await Review.findByIdAndUpdate(
      id,
      { rating: req.body.rating, comment: req.body.comment },
      { new: true }
    ).populate('user', 'name avatar');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: { review }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: error.message
    });
  }
};

// ✅ Delete Review
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (review.user.toString() !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
      return;
    }

    await Review.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
};
