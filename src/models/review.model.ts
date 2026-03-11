import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  property: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    property: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    }
  },
  { timestamps: true }
);

reviewSchema.index({ property: 1, user: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
