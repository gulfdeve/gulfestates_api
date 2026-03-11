import mongoose, { Document, Schema } from "mongoose";

export interface IHomePageLead extends Document {
    fullName: string;
    email: string;
    phoneNumber: string;
    country: string;
    countryCode: string;
    budget: string;
    propertyType: string;
    serviceCharges?: string;
    consent?: boolean;
    source?: string;
    status?: string;
    createdAt: Date;
    updatedAt: Date;
}

const HomePageLeadSchema = new Schema<IHomePageLead>(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
        },
        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
            trim: true
        },
        country: {
            type: String,
            required: [true, "Country is required"],
            trim: true
        },
        countryCode: {
            type: String,
            required: [true, "Country code is required"],
            trim: true
        },
        budget: {
            type: String,
            required: [true, "Budget is required"],
            enum: ["500k - 1M", "1M - 2M", "2M - 4M", "4M+", "Select Budget"],
            default: "Select Budget"
        },
        propertyType: {
            type: String,
        },
        serviceCharges: {
            type: String,
            default: "N/A"
        },
        consent: {
            type: Boolean,
            default: false
        },
        source: {
            type: String,
            default: "From Homepage",
            trim: true
        },
        status: {
            type: String,
            enum: ["New", "Contacted", "Qualified", "Converted", "Lost"],
            default: "New"
        },
    },
    { timestamps: true }
);

// Index for better query performance
HomePageLeadSchema.index({ email: 1 });
HomePageLeadSchema.index({ createdAt: -1 });
HomePageLeadSchema.index({ status: 1 });

export default mongoose.models.HomePageLead ||
    mongoose.model<IHomePageLead>("HomePageLead", HomePageLeadSchema);

