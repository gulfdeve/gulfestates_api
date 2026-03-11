import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  blog: mongoose.Types.ObjectId;
  name: string;
  email: string;
  comment: string;
  approved: boolean;
  saveInfo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    comment: { type: String, required: true },
    approved: { type: Boolean, default: false },
    saveInfo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CommentSchema.index({ blog: 1 });
CommentSchema.index({ approved: 1 });

export default mongoose.models.Comment ||
  mongoose.model<IComment>("Comment", CommentSchema);
