// models/jobApplication.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IJobApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  coverLetter: string;
  resume?: string; // URL or path to uploaded resume
  portfolio?: string; // URL or path to uploaded portfolio (optional)
  status: string; // "Pending", "Reviewed", "Accepted", "Rejected"
  createdAt?: Date;
  updatedAt?: Date;
}

const jobApplicationSchema = new Schema<IJobApplication>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    coverLetter: {
      type: String,
      required: true,
      trim: true
    },
    resume: {
      type: String,
      trim: true
    },
    portfolio: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Accepted", "Rejected"],
      default: "Pending"
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
jobApplicationSchema.index({ jobId: 1, createdAt: -1 });
jobApplicationSchema.index({ email: 1, jobId: 1 });

export default mongoose.model<IJobApplication>("JobApplication", jobApplicationSchema);

