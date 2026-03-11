// controllers/sitemap.controller.ts
import { Request, Response } from "express";
import Blog from "../models/blog.model.js";
import Property from "../models/property.model.js";
import OffPlan from "../models/OffPlan.js";

const BASE_URL = (process.env.SITEMAP_BASE_URL || process.env.FRONTEND_URL || "https://gulfestates.ae").replace(/\/$/, "");

export interface SitemapEntry {
  loc: string;
  lastmod: string;
}

export const getSitemapSlugs = async (req: Request, res: Response): Promise<void> => {
  try {
    const blogs = await Blog.find({ published: true })
      .select("slug title languages updatedAt createdAt")
      .lean();

    const properties = await Property.find({})
      .select("title slug updatedAt createdAt")
      .lean();

    const offPlans = await OffPlan.find({})
      .select("title slug updatedAt createdAt")
      .lean();

    const getLastModified = (item: any): string => {
      if (item.updatedAt) return new Date(item.updatedAt).toISOString();
      if (item.createdAt) return new Date(item.createdAt).toISOString();
      return new Date().toISOString();
    };

    const entries: SitemapEntry[] = [];

    // Blogs: one full URL per locale only when that locale has a title
    blogs.forEach((blog: any) => {
      if (!blog.slug || !String(blog.slug).trim()) return;
      const mainSlug = String(blog.slug).trim();
      const lastmod = getLastModified(blog);
      if (blog.title && String(blog.title).trim()) {
        entries.push({ loc: `${BASE_URL}/en/blogs/${mainSlug}`, lastmod });
      }
      if (blog.languages?.fr?.title && String(blog.languages.fr.title).trim()) {
        entries.push({ loc: `${BASE_URL}/fr/blogs/${mainSlug}`, lastmod });
      }
      if (blog.languages?.es?.title && String(blog.languages.es.title).trim()) {
        entries.push({ loc: `${BASE_URL}/es/blogs/${mainSlug}`, lastmod });
      }
    });

    // Properties: one full URL per locale only when that locale has both title and slug
    properties.forEach((property: any) => {
      if (!property.slug || !property.title || typeof property.title !== "object" || typeof property.slug !== "object") return;
      const title = property.title as Record<string, string>;
      const slug = property.slug as Record<string, string>;
      const lastmod = getLastModified(property);
      if (title?.en && String(title.en).trim() && slug?.en && String(slug.en).trim()) {
        entries.push({ loc: `${BASE_URL}/en/properties/${String(slug.en).trim()}`, lastmod });
      }
      if (title?.fr && String(title.fr).trim() && slug?.fr && String(slug.fr).trim()) {
        entries.push({ loc: `${BASE_URL}/fr/properties/${String(slug.fr).trim()}`, lastmod });
      }
      if (title?.es && String(title.es).trim() && slug?.es && String(slug.es).trim()) {
        entries.push({ loc: `${BASE_URL}/es/properties/${String(slug.es).trim()}`, lastmod });
      }
    });

    // Off-plans: one full URL per locale only when that locale has both title and slug
    offPlans.forEach((offPlan: any) => {
      if (!offPlan.slug || !offPlan.title || typeof offPlan.title !== "object" || typeof offPlan.slug !== "object") return;
      const title = offPlan.title as Record<string, string>;
      const slug = offPlan.slug as Record<string, string>;
      const lastmod = getLastModified(offPlan);
      if (title?.en && String(title.en).trim() && slug?.en && String(slug.en).trim()) {
        entries.push({ loc: `${BASE_URL}/en/off-plan/${String(slug.en).trim()}`, lastmod });
      }
      if (title?.fr && String(title.fr).trim() && slug?.fr && String(slug.fr).trim()) {
        entries.push({ loc: `${BASE_URL}/fr/off-plan/${String(slug.fr).trim()}`, lastmod });
      }
      if (title?.es && String(title.es).trim() && slug?.es && String(slug.es).trim()) {
        entries.push({ loc: `${BASE_URL}/es/off-plan/${String(slug.es).trim()}`, lastmod });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        entries,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching sitemap slugs",
      error: error.message,
    });
  }
};
