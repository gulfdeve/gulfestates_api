import mongoose, { Document, Schema } from "mongoose";

export interface IPagesContent extends Document {
  pageType: string;
  locale: "en" | "fr" | "es";
  title: string;
  subtitle?: string;
  bannerType: "image" | "video";
  bannerUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const PagesContentSchema = new Schema<IPagesContent>(
  {
    pageType: {
      type: String,
      required: true,
      enum: [
        "home",
        "offplan",
        "properties",
        "buy",
        "rent",
        "blogs",
        "about",
        "ourteam",
        "contact",
        "privacy",
        "terms",
        "careers",
      ],
    },
    locale: {
      type: String,
      required: true,
      enum: ["en", "fr", "es"],
    },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    bannerType: { type: String, required: true, enum: ["image", "video"] },
    bannerUrl: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: "Invalid banner URL",
      },
    },
  },
  { timestamps: true }
);

// One document per pageType per locale - delete/edit/create only affects that locale
PagesContentSchema.index({ pageType: 1, locale: 1 }, { unique: true });

export default
  mongoose.models.PagesContent ||
  mongoose.model<IPagesContent>("PagesContent", PagesContentSchema);
