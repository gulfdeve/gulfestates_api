import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  type: "property" | "blog" | "testimonial" | "contact" | "homepage_lead" | "newsletter" | "delete" | "job" | "team";
  action: "created" | "deleted" | "updated";
  title: string;
  message: string;
  relatedId?: string; // ID of the related item (property, blog, etc.)
  read: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ["property", "blog", "testimonial", "contact", "homepage_lead", "newsletter", "delete", "job", "team"],
      required: true,
    },
    action: {
      type: String,
      enum: ["created", "deleted", "updated"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedId: {
      type: String,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
notificationSchema.index({ read: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);

