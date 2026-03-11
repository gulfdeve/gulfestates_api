// models/blog.model.js
import mongoose, { Schema, Document } from "mongoose";

export interface IBlog extends Document {
  // English (default)
  title: string;
  excerpt: string;
  content: string;

  // Multi-language support
  languages?: {
    fr?: {
      title?: string;
      excerpt?: string;
      content?: string;
    };
    es?: {
      title?: string;
      excerpt?: string;
      content?: string;
    };
  };

  slug: string;
  image: string;
  author: string;
  date: string;
  category?: string;
  tags?: string[];
  featured?: boolean;
  published?: boolean;
  seo?: {
    title?: string;
    description?: string;
    schema?: {
      en?: string;
      fr?: string;
      es?: string;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const languageSchema = new Schema(
  {
    title: { type: String, trim: true },
    excerpt: { type: String, trim: true },
    content: { type: String }
  },
  { _id: false }
);

const seoSchemaLanguages = new Schema(
  {
    en: { type: String },
    fr: { type: String },
    es: { type: String },
  },
  { _id: false }
);

const seoSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    schema: seoSchemaLanguages // Multilingual schema support
  },
  { _id: false }
);

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    excerpt: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    languages: {
      fr: languageSchema,
      es: languageSchema
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    image: {
      type: String,
      required: true
    },
    author: {
      type: String,
      default: "Admin",
      trim: true
    },
    date: {
      type: String,
      required: true
    },
    category: {
      type: String,
      trim: true,
      default: "General"
    },
    tags: [{
      type: String,
      trim: true
    }],
    featured: {
      type: Boolean,
      default: false
    },
    published: {
      type: Boolean,
      default: false
    },
    seo: seoSchema
  },
  {
    timestamps: true
  }
);

// Index for better query performance
blogSchema.index({ featured: -1, createdAt: -1 });

export default mongoose.model<IBlog>("Blog", blogSchema);