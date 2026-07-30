import mongoose from "mongoose";
import { slugify } from "./slugify.util.js";
import Redirect, { RedirectEntityType } from "../models/Redirect.js";

const LOCALES = ["en", "fr", "es"] as const;
type Locale = (typeof LOCALES)[number];

/**
 * Applies a manual slug edit for one or more locales, preserving any
 * previous slug as a redirect so old links keep resolving.
 * Only locales present (and non-empty) in `rawSlugInput` are changed;
 * everything else is carried over from the document's current slug.
 */
export async function applySlugUpdate(
  Model: mongoose.Model<any>,
  entityType: RedirectEntityType,
  doc: any,
  rawSlugInput: Record<string, unknown> | undefined
): Promise<{ error?: string; slug?: Record<string, string> }> {
  const currentSlug = (doc.slug || {}) as Record<string, string>;
  const mergedSlug: Record<string, string> = { ...currentSlug };

  if (!rawSlugInput || typeof rawSlugInput !== "object") {
    return { slug: mergedSlug };
  }

  for (const locale of LOCALES as readonly Locale[]) {
    const rawValue = rawSlugInput[locale];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    const newSlug = slugify(String(rawValue));
    const oldSlug = currentSlug[locale];
    if (!newSlug || newSlug === oldSlug) continue;

    const conflict = await Model.findOne({
      [`slug.${locale}`]: newSlug,
      _id: { $ne: doc._id },
    });
    if (conflict) {
      return {
        error: `Slug "${newSlug}" is already in use (${locale}). Choose a different one.`,
      };
    }

    // Preserve the old slug as a redirect so existing links keep working
    if (oldSlug) {
      await Redirect.updateOne(
        { entityType, oldSlug, locale },
        { $setOnInsert: { entityType, entityId: doc._id, oldSlug, locale } },
        { upsert: true }
      );
    }

    mergedSlug[locale] = newSlug;
  }

  return { slug: mergedSlug };
}

/**
 * Resolves an old slug to the entity's current slug for the given locale,
 * following the redirect chain if the entity has since been renamed again.
 */
export async function resolveRedirect(
  Model: mongoose.Model<any>,
  entityType: RedirectEntityType,
  locale: string,
  oldSlug: string
): Promise<string | null> {
  const entry = await Redirect.findOne({ entityType, oldSlug, locale });
  if (!entry) return null;

  const doc = await Model.findById(entry.entityId);
  if (!doc) return null;

  return doc.slug?.[locale] || doc.slug?.en || null;
}
