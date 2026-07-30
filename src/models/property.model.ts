import mongoose, { Schema, Document } from "mongoose";
import { slugify } from "../utils/slugify.util.js";

interface IAgent {
  name: string;
  email: string;
  phone: string;
  brokerNo?: string;
  image?: string;
  whatsapp?: string;
}

interface IBuildingInfo {
  floors?: number;
  pools?: number;
  parking?: number;
  elevators?: number;
  area?: string;
  retail?: number;
  year?: number;
}

interface ILandmark {
  title: string;
  time: string;
  image: string;
}

interface IPropertyLanguages {
  en: string;
  fr?: string;
  es?: string;
}

// REMOVED location image interface
export interface IProperty extends Document {
  title: IPropertyLanguages;
  description?: IPropertyLanguages;
  location: IPropertyLanguages;  // Back to original IPropertyLanguages
  price: number;
  type: string;
  beds: number;
  baths: number;
  size: number | string;  // Supports "600" or "600 - 600" range format
  image: string;
  images: string[];
  for: "buy" | "rent";
  amenities?: string[];
  nearbyLandmarks?: ILandmark[];
  agent?: IAgent;
  buildingInfo?: IBuildingInfo;
  projectStatus?: string;
  rentDuration?: string;
  geoLocation?: {
    latitude?: string;
    longitude?: string;
  };
  seo?: {
    title?: IPropertyLanguages;
    description?: IPropertyLanguages;
    schema?: string;
  };
  slug?: IPropertyLanguages;
  brochure?: string;
  dldPermitNumber?: string;
  qrImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const languagesSchema = new Schema(
  {
    en: { type: String },
    fr: { type: String },
    es: { type: String },
  },
  { _id: false }
);

// REMOVED locationSchema - using languagesSchema for location again
const seoSchema = new Schema(
  {
    title: languagesSchema,
    description: languagesSchema,
    schema: languagesSchema, // Multilingual schema support
  },
  { _id: false }
);

const landmarkSchema = new Schema({
  title: { type: String, required: true },
  time: { type: String, required: true },
  image: { type: String, required: true },
});

const agentSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  brokerNo: { type: String },
  image: { type: String },
  whatsapp: { type: String },
});

const buildingInfoSchema = new Schema({
  floors: { type: Number },
  pools: { type: Number },
  parking: { type: Number },
  elevators: { type: Number },
  area: { type: String },
  retail: { type: Number },
  year: { type: Number },
});

const propertySchema = new Schema<IProperty>(
  {
    title: {
      type: languagesSchema,
      required: [true, "Title is required"]
    },
    description: {
      type: languagesSchema,
      default: { en: "", fr: "", es: "" }
    },
    location: {
      type: languagesSchema,  // Back to languagesSchema
      required: true
    },
    price: { type: Number, required: true },
    type: { type: String, required: true },
    beds: { type: Number, required: true },
    baths: { type: Number, required: true },
    size: { type: Schema.Types.Mixed, required: true },  // Number or String (e.g. "600 - 600")
    image: {
      type: String,
      required: true,
    },
    images: [{
      type: String,
      default: []
    }],
    for: { type: String, enum: ["buy", "rent"], required: true },
    amenities: [{
      type: String,
      default: []
    }],
    nearbyLandmarks: [landmarkSchema],
    agent: agentSchema,
    buildingInfo: buildingInfoSchema,
    projectStatus: {
      type: String,
      default: ""
    },
    rentDuration: {
      type: String,
      enum: ["Day", "Week", "Month", "3 Month", "6 Month", "Year", "5 Year"],
      required: function () {
        return this.for === "rent";
      }
    },
    geoLocation: {
      latitude: { type: String, trim: true },
      longitude: { type: String, trim: true }
    },
    seo: seoSchema,
    slug: {
      type: languagesSchema,
      default: { en: "", fr: "", es: "" }
    },
    brochure: {
      type: String,
      default: ""
    },
    dldPermitNumber: {
      type: String,
      default: ""
    },
    qrImage: {
      type: String,
      default: ""
    },
  },
  { timestamps: true }
);

// Helper function to generate unique slug for a specific language
async function generateUniqueSlug(
  baseSlug: string,
  model: mongoose.Model<any>,
  slugField: "slug.en" | "slug.fr" | "slug.es",
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let count = 0;
  const isNewDocument = !excludeId;

  while (true) {
    const query: any = { [slugField]: slug };
    if (!isNewDocument) {
      query._id = { $ne: excludeId };
    }

    const existing = await model.findOne(query);
    if (!existing) {
      return slug;
    }

    count++;
    slug = `${baseSlug}-${count}`;
  }
}

// Pre-save hook: slugs are auto-generated on first creation only.
// Edits set the slug explicitly via the updateProperty controller (see slugRedirect.util.ts),
// which also preserves the old slug as a redirect.
propertySchema.pre<IProperty>("save", async function (next) {
  if (this.isNew && this.title) {
    const Property = mongoose.model<IProperty>("Property");

    if (!this.slug) {
      this.slug = { en: "", fr: "", es: "" };
    }

    if (this.title.en && !this.slug.en) {
      const baseSlug = slugify(this.title.en);
      this.slug.en = await generateUniqueSlug(baseSlug, Property, "slug.en");
    }

    if (this.title.fr && !this.slug.fr) {
      const baseSlug = slugify(this.title.fr);
      this.slug.fr = await generateUniqueSlug(baseSlug, Property, "slug.fr");
    }

    if (this.title.es && !this.slug.es) {
      const baseSlug = slugify(this.title.es);
      this.slug.es = await generateUniqueSlug(baseSlug, Property, "slug.es");
    }
  }
  next();
});

// Index for better performance
propertySchema.index({ "title.en": "text", "location.en": "text" });
propertySchema.index({ for: 1, type: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ "slug.en": 1 });
propertySchema.index({ "slug.fr": 1 });
propertySchema.index({ "slug.es": 1 });

export default mongoose.model<IProperty>("Property", propertySchema);