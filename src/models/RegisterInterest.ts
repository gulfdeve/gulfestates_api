import mongoose, { Schema, Document } from "mongoose";

export interface IRegisterInterest extends Document {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  projectName: string;
}

const registerInterestSchema = new Schema<IRegisterInterest>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    countryCode: { type: String, default: "+971" },
    projectName: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IRegisterInterest>(
  "RegisterInterest",
  registerInterestSchema
);
