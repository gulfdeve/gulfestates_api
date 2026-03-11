import mongoose, { Document, Schema } from "mongoose";

export interface IContact extends Document {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Contact ||
  mongoose.model<IContact>("Contact", ContactSchema);
