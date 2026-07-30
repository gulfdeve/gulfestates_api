import mongoose, { Schema, Document } from "mongoose";

export type RedirectEntityType = "offplan" | "property";

export interface IRedirect extends Document {
  entityType: RedirectEntityType;
  entityId: mongoose.Types.ObjectId;
  locale: "en" | "fr" | "es";
  oldSlug: string;
  createdAt: Date;
}

const RedirectSchema: Schema = new Schema(
  {
    entityType: { type: String, enum: ["offplan", "property"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    locale: { type: String, enum: ["en", "fr", "es"], required: true },
    oldSlug: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

// A given old slug can only redirect to one place per entity type/locale
RedirectSchema.index({ entityType: 1, oldSlug: 1, locale: 1 }, { unique: true });
RedirectSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.models.Redirect ||
  mongoose.model<IRedirect>("Redirect", RedirectSchema);
