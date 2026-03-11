import mongoose, { Document, Schema } from "mongoose";

export interface IEmailMarketing extends Document {
  title: string;
  audience: "Home Page Leads" | "Contact Us" | "Newsletter";
  recipients: string[]; // Array of email addresses
  emailTitle: string;
  message: string;
  ctaLink?: string;
  image?: string;
  status: "Sent" | "Scheduled" | "Failed";
  sentAt?: Date;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmailMarketingSchema = new Schema<IEmailMarketing>(
  {
    title: {
      type: String,
      required: [true, "Campaign title is required"],
      trim: true,
    },
    audience: {
      type: String,
      required: [true, "Audience is required"],
      enum: ["Home Page Leads", "Contact Us", "Newsletter"],
    },
    recipients: {
      type: [String],
      required: [true, "Recipients are required"],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0;
        },
        message: "At least one recipient is required",
      },
    },
    emailTitle: {
      type: String,
      required: [true, "Email title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    ctaLink: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Sent", "Scheduled", "Failed"],
      default: "Sent",
    },
    sentAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for better query performance
EmailMarketingSchema.index({ audience: 1 });
EmailMarketingSchema.index({ status: 1 });
// Note: createdAt is already indexed by timestamps: true

export default mongoose.models.EmailMarketing ||
  mongoose.model<IEmailMarketing>("EmailMarketing", EmailMarketingSchema);

