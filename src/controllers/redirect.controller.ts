import { Request, Response } from "express";
import mongoose from "mongoose";
import Redirect, { RedirectEntityType } from "../models/Redirect.js";
import OffPlan from "../models/OffPlan.js";
import Property from "../models/property.model.js";
import { slugify } from "../utils/slugify.util.js";
import { resolveRedirect } from "../utils/slugRedirect.util.js";

const MODELS: Record<RedirectEntityType, mongoose.Model<any>> = {
  offplan: OffPlan,
  property: Property,
};

const isValidEntityType = (value: string): value is RedirectEntityType =>
  value === "offplan" || value === "property";

// Public: resolve an old slug to the entity's current slug (used by the frontend
// to redirect visitors landing on a stale URL after a slug edit)
export const resolveEntityRedirect = async (req: Request, res: Response) => {
  try {
    const { entityType, locale, slug } = req.params;

    if (!isValidEntityType(entityType) || !["en", "fr", "es"].includes(locale)) {
      return res.status(400).json({ success: false, message: "Invalid entity type or locale" });
    }

    const newSlug = await resolveRedirect(MODELS[entityType], entityType, locale, slug);
    if (!newSlug) {
      return res.status(404).json({ success: false, message: "No redirect found" });
    }

    res.status(200).json({ success: true, newSlug });
  } catch (err) {
    console.error("Error resolving redirect:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Admin: list redirects captured for a given entity
export const listEntityRedirects = async (req: Request, res: Response) => {
  try {
    const { entityType, id } = req.params;
    if (!isValidEntityType(entityType)) {
      return res.status(400).json({ success: false, message: "Invalid entity type" });
    }

    const redirects = await Redirect.find({ entityType, entityId: id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: redirects });
  } catch (err) {
    console.error("Error listing redirects:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Admin: manually add a redirect for an entity (e.g. a legacy URL from before this system existed)
export const addEntityRedirect = async (req: Request, res: Response) => {
  try {
    const { entityType, id } = req.params;
    const { oldSlug, locale } = req.body;

    if (!isValidEntityType(entityType) || !oldSlug || !locale || !["en", "fr", "es"].includes(locale)) {
      return res.status(400).json({ success: false, message: "oldSlug and a valid locale are required" });
    }

    const doc = await MODELS[entityType].findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const normalizedSlug = slugify(String(oldSlug));
    const currentSlug = doc.slug?.[locale];
    if (normalizedSlug === currentSlug) {
      return res.status(400).json({ success: false, message: "This is already the current slug" });
    }

    // Don't let a redirect shadow another entity's live slug
    const conflict = await MODELS[entityType].findOne({ [`slug.${locale}`]: normalizedSlug });
    if (conflict) {
      return res.status(400).json({ success: false, message: "This slug is currently in use" });
    }

    const existing = await Redirect.findOne({ entityType, oldSlug: normalizedSlug, locale });
    if (existing) {
      return res.status(400).json({ success: false, message: "A redirect for this slug already exists" });
    }

    const redirect = await Redirect.create({
      entityType,
      entityId: doc._id,
      locale,
      oldSlug: normalizedSlug,
    });
    res.status(201).json({ success: true, data: redirect });
  } catch (err) {
    console.error("Error adding redirect:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Admin: remove a redirect entry
export const deleteEntityRedirect = async (req: Request, res: Response) => {
  try {
    const { entityType, id, redirectId } = req.params;
    if (!isValidEntityType(entityType)) {
      return res.status(400).json({ success: false, message: "Invalid entity type" });
    }

    const redirect = await Redirect.findOneAndDelete({ _id: redirectId, entityType, entityId: id });
    if (!redirect) {
      return res.status(404).json({ success: false, message: "Redirect not found" });
    }

    res.status(200).json({ success: true, message: "Redirect deleted" });
  } catch (err) {
    console.error("Error deleting redirect:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
