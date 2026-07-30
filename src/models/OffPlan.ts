import mongoose, { Schema, Document } from "mongoose";
import { slugify } from "../utils/slugify.util.js";

// Interface for the OffPlan document
export interface IOffPlan extends Document {
  title: {
    en: string;
    fr?: string;
    es?: string;
  };
  location: {
    en: string;
    fr?: string;
    es?: string;
  };
  developer: string;
  type: string;
  for: "buy" | "rent";
  handover: string;
  priceFrom: string;
  paymentPlan: string;
  bedRange?: string;
  bathRange?: string;
  sizeRange?: string;
  image: string;
  images?: string[];
  description?: {
    en?: string;
    fr?: string;
    es?: string;
  };
  nearbyLandmarks?: {
    title: string;
    time: string;
    image: string;
  }[];
  amenities?: string[];
  propertyType?: string;
  serviceCharges?: string;
  status?: string;
  projectStatus?: string;
  rentDuration?: string;
  featured?: boolean;
  seo?: {
    title?: {
      en?: string;
      fr?: string;
      es?: string;
    };
    description?: {
      en?: string;
      fr?: string;
      es?: string;
    };
    schema?: string;
  };
  geoLocation?: {
    latitude?: string;
    longitude?: string;
  };
  slug?: {
    en: string;
    fr?: string;
    es?: string;
  };
  brochure?: string;
  dldPermitNumber?: string;
  qrImage?: string;
  createdAt?: Date;
  updatedAt?: Date;
  formattedDate?: string; // Virtual property
}

// Sub-schemas
const landmarkSchema = new Schema({
  title: { type: String, required: true },
  time: { type: String, required: true },
  image: {
    type: String,
    required: true,
    validate: {
      validator: function (v: string) {
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Invalid image URL'
    }
  }
}, { _id: false });

const languagesSchema = new Schema({
  en: { type: String },
  fr: { type: String },
  es: { type: String }
}, { _id: false });

const seoSchema = new Schema({
  title: languagesSchema,
  description: languagesSchema,
  schema: languagesSchema, // Multilingual schema support
}, { _id: false });

// Main schema
const OffPlanSchema: Schema = new Schema(
  {
    title: {
      type: languagesSchema,
      default: { en: "", fr: "", es: "" }
    },
    location: {
      type: languagesSchema,
      default: { en: "", fr: "", es: "" }
    },
    developer: {
      type: String,
      trim: true,
      default: ""
    },
    type: {
      type: String,
      enum: ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex'],
      default: 'Apartment'
    },
    for: {
      type: String,
      enum: ['buy', 'rent'],
      default: 'buy'
    },
    handover: {
      type: String,
      default: ""
    },
    priceFrom: {
      type: String,
      default: ""
    },
    paymentPlan: {
      type: String,
      default: ""
    },
    bedRange: {
      type: String,
      default: "N/A"
    },
    bathRange: {
      type: String,
      default: "N/A"
    },
    sizeRange: {
      type: String,
      default: "N/A"
    },
    image: {
      type: String,
      required: [true, 'Main image is required'],
      validate: {
        validator: function (v: string) {
          // Accept data URLs (base64 images)
          if (v && v.startsWith('data:image/')) return true;
          // Accept HTTP/HTTPS URLs
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: 'Invalid image URL'
      }
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.every((img: string) => {
            // Accept data URLs (base64 images)
            if (img && img.startsWith('data:image/')) return true;
            // Accept HTTP/HTTPS URLs
            return /^https?:\/\/.+\..+/.test(img);
          });
        },
        message: 'Invalid image URL in images array'
      }
    },
    description: {
      type: languagesSchema,
      default: { en: "", fr: "", es: "" }
    },
    nearbyLandmarks: {
      type: [landmarkSchema],
      default: []
    },
    amenities: {
      type: [String],
      default: []
    },
    propertyType: {
      type: String,
      default: "N/A"
    },
    serviceCharges: {
      type: String,
      default: "N/A"
    },
    status: {
      type: String,
      enum: ['Available', 'Coming Soon', 'Sold Out', 'Limited Units'],
      default: 'Available'
    },
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
    featured: {
      type: Boolean,
      default: false
    },
    seo: seoSchema,
    geoLocation: {
      latitude: { type: String },
      longitude: { type: String }
    },
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
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
// Edits set the slug explicitly via the updateOffPlan controller (see slugRedirect.util.ts),
// which also preserves the old slug as a redirect.
OffPlanSchema.pre<IOffPlan>("save", async function (next) {
  if (this.isNew && this.title) {
    const OffPlan = mongoose.model<IOffPlan>("OffPlan");

    // Initialize slug object if it doesn't exist
    if (!this.slug) {
      (this as any).slug = { en: "", fr: "", es: "" };
    }

    const slugObj = this.slug as { en: string; fr?: string; es?: string };

    if (this.title.en && !slugObj.en) {
      const baseSlug = slugify(this.title.en);
      slugObj.en = await generateUniqueSlug(baseSlug, OffPlan, "slug.en");
    }

    if (this.title.fr && !slugObj.fr) {
      const baseSlug = slugify(this.title.fr);
      slugObj.fr = await generateUniqueSlug(baseSlug, OffPlan, "slug.fr");
    }

    if (this.title.es && !slugObj.es) {
      const baseSlug = slugify(this.title.es);
      slugObj.es = await generateUniqueSlug(baseSlug, OffPlan, "slug.es");
    }
  }
  next();
});

// Index for better query performance
OffPlanSchema.index({ "title.en": "text", "location.en": "text" });
OffPlanSchema.index({ featured: 1, status: 1 });
OffPlanSchema.index({ for: 1, type: 1 });
OffPlanSchema.index({ createdAt: -1 });
OffPlanSchema.index({ "slug.en": 1 });
OffPlanSchema.index({ "slug.fr": 1 });
OffPlanSchema.index({ "slug.es": 1 });

// Virtual for formatted creation date
OffPlanSchema.virtual('formattedDate').get(function (this: IOffPlan) {
  if (this.createdAt && this.createdAt instanceof Date) {
    return this.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return 'Date not available';
});

export default mongoose.models.OffPlan ||
  mongoose.model<IOffPlan>("OffPlan", OffPlanSchema);