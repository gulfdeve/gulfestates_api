import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  email: string;
  createdAt: Date;
}

const subscriptionSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ISubscription>("Subscription", subscriptionSchema);
