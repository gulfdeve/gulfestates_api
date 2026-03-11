// models/job.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  // English (default)
  title: string;
  description: string;

  // Multi-language support
  languages?: {
    fr?: {
      title?: string;
      description?: string;
    };
    es?: {
      title?: string;
      description?: string;
    };
  };

  // Job details
  location: string; // "On-site", "Remote", "Hybrid"
  type: string; // "Full Time", "Part Time", "Contract"
  status: string; // "Open", "Closed"

  // Optional fields
  department?: string;
  experience?: string; // "Entry Level", "Mid Level", "Senior"
  salary?: string;

  // SEO
  seo?: {
    title?: string;
    description?: string;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const languageSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  { _id: false }
);

const seoSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  { _id: false }
);

const jobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    languages: {
      fr: languageSchema,
      es: languageSchema
    },
    location: {
      type: String,
      required: true,
      enum: ["On-site", "Remote", "Hybrid"],
      default: "On-site"
    },
    type: {
      type: String,
      required: true,
      enum: ["Full Time", "Part Time", "Contract"],
      default: "Full Time"
    },
    status: {
      type: String,
      required: true,
      enum: ["Open", "Closed"],
      default: "Open"
    },
    department: {
      type: String,
      trim: true
    },
    experience: {
      type: String,
      enum: {
        values: ["Entry Level", "Mid Level", "Senior"],
        message: "{VALUE} is not a valid experience level"
      },
      trim: true,
      default: undefined
    },
    salary: {
      type: String,
      trim: true
    },
    seo: seoSchema
  },
  {
    timestamps: true
  }
);

// Index for better query performance
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ location: 1, type: 1 });

export default mongoose.model<IJob>("Job", jobSchema);

