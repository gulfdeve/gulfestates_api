import mongoose, { Schema, Document } from "mongoose";

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId;
  owner: {
    name: string;
    role: string;
    description: {
      en: string;
      fr: string;
      es: string;
    };
    image: string;
  };
  title: {
    en: string;
    fr: string;
    es: string;
  };
  description: {
    en: string;
    fr: string;
    es: string;
  };
  teamslider: Array<{
    image: string;
    name: string;
    index: number;
  }>;
  team: Array<{
    name: string;
    role: string;
    image: string;
    department: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

const languageFieldSchema = new Schema(
  {
    en: { type: String, required: false, trim: true, default: "" },
    fr: { type: String, required: false, trim: true, default: "" },
    es: { type: String, required: false, trim: true, default: "" },
  },
  { _id: false }
);

const ownerSchema = new Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    description: {
      type: languageFieldSchema,
      required: false,
      default: { en: "", fr: "", es: "" },
    },
    image: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const teamSliderItemSchema = new Schema(
  {
    image: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    index: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const teamMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const teamSchema = new Schema<ITeam>(
  {
    owner: {
      type: ownerSchema,
      required: false,
      default: {
        name: "",
        role: "",
        description: { en: "", fr: "", es: "" },
        image: "",
      },
    },
    title: {
      type: languageFieldSchema,
      required: false,
      default: { en: "", fr: "", es: "" },
    },
    description: {
      type: languageFieldSchema,
      required: false,
      default: { en: "", fr: "", es: "" },
    },
    teamslider: {
      type: [teamSliderItemSchema],
      default: [],
    },
    team: {
      type: [teamMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Team || mongoose.model<ITeam>("Team", teamSchema);
