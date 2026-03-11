import mongoose, { Schema, Document } from 'mongoose';

export interface ITestimonial extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  role: string;
  text: string;
  rating: number;
  featured: boolean;
  locale: string; // 'en', 'fr', or 'es' - tracks which language this testimonial belongs to
  languages?: {
    es?: {
      text?: string;
      role?: string;
    };
    fr?: {
      text?: string;
      role?: string;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

const languageSchema = new Schema(
  {
    text: { type: String, trim: true },
    role: { type: String, trim: true }
  },
  { _id: false }
);

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true
    },
    text: {
      type: String,
      required: [true, 'Testimonial text is required'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    featured: {
      type: Boolean,
      default: false
    },
    locale: {
      type: String,
      enum: ['en', 'fr', 'es'],
      default: 'en'
    },
    languages: {
      es: languageSchema,
      fr: languageSchema
    }
  },
  {
    timestamps: true,
    versionKey: '__v'
  }
);

export default mongoose.models.Testimonial ||
  mongoose.model<ITestimonial>('Testimonial', testimonialSchema);

