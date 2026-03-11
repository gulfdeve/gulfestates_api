// controllers/blog.controller.js
import { Request, Response } from "express";
import mongoose from "mongoose";
import Blog, { IBlog } from "../models/blog.model.js";
import { getLocalizedDocuments, getLocalizedDocument } from "../utils/localization.util.js";
import { createNotification } from "./notification.controller.js";

// controllers/blog.controller.js - UPDATE createBlog function
export const createBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      slug,
      image,
      excerpt,
      content,
      author,
      date,
      category,
      tags,
      featured,
      published,
      seo,
      languages
    } = req.body;

    // Generate slug from title if not provided
    let blogSlug = slug;
    if (!blogSlug && title) {
      blogSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const existingBlog = await Blog.findOne({ slug: blogSlug });
    if (existingBlog) {
      res.status(400).json({
        success: false,
        message: "A blog with this slug already exists.",
      });
      return;
    }

    // Normalize SEO schema: if schema is a string, convert to { en: string }
    let normalizedSeo = seo || {};
    if (normalizedSeo.schema && typeof normalizedSeo.schema === 'string') {
      normalizedSeo = {
        ...normalizedSeo,
        schema: { en: normalizedSeo.schema }
      };
    }

    const blog = await Blog.create({
      title,
      slug: blogSlug,
      image,
      excerpt,
      content,
      author: author || "Admin",
      date: date || new Date().toISOString(),
      category: category || "General",
      tags: tags || [],
      featured: featured || false,
      published: published === true, // Default to draft; only published when explicitly true
      seo: normalizedSeo,
      languages: languages || {}
    });

    // Create notification
    await createNotification(
      "blog",
      "created",
      "New Blog Added",
      `A new blog "${title}" has been added.`,
      String(blog._id)
    );

    res.status(201).json({
      success: true,
      message: "Blog created successfully.",
      data: blog,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating blog",
      error: error.message,
    });
  }
};

// ✅ Get All Blogs with Pagination
export const getBlogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;
    const locale = (req.query.locale as string) || 'en';
    const isAdmin = req.query.admin === 'true' || req.headers['x-admin-view'] === 'true';
    const excludeContent = req.query.excludeContent === 'true'; // Exclude content for list views
    const skip = (page - 1) * limit;

    // Projection: exclude large content fields for list views (image + title + metadata only)
    const listProjection = excludeContent ? '-content -languages.fr.content -languages.es.content' : '';

    // If admin request, return all blogs without locale filtering
    if (isAdmin) {
      const adminQuery = Blog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
      const [allBlogs, totalCount] = await Promise.all([
        listProjection ? adminQuery.select(listProjection) : adminQuery,
        Blog.countDocuments({})
      ]);

      let adminBlogs = allBlogs.map((blog: any) => {
        const blogObj = blog.toObject ? blog.toObject() : blog;
        if (excludeContent) {
          delete blogObj.content;
          if (blogObj.languages) {
            if (blogObj.languages.fr) delete blogObj.languages.fr.content;
            if (blogObj.languages.es) delete blogObj.languages.es.content;
          }
        }
        return blogObj;
      });

      res.status(200).json({
        success: true,
        data: {
          items: adminBlogs,
          total: totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit),
        }
      });
      return;
    }

    // Language-specific filtering: only show items with content in the requested language
    let blogs: any[] = [];
    let total = 0;

    if (locale === 'en') {
      // For English: get all published blogs, then filter to exclude French/Spanish blogs
      const enQuery = Blog.find({ title: { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
      const allBlogs = await (listProjection ? enQuery.select(listProjection) : enQuery);

      // Filter to only show English blogs (exclude where title matches French/Spanish title)
      blogs = allBlogs.filter((blog: any) => {
        const mainTitle = blog.title?.trim();
        const frenchTitle = blog.languages?.fr?.title?.trim();
        const spanishTitle = blog.languages?.es?.title?.trim();

        // Exclude if main title matches French title (it's a French blog)
        if (frenchTitle && mainTitle === frenchTitle) {
          return false;
        }

        // Exclude if main title matches Spanish title (it's a Spanish blog)
        if (spanishTitle && mainTitle === spanishTitle) {
          return false;
        }

        // Include: has English title that's different from French/Spanish titles
        return true;
      });

      total = blogs.length;
      blogs = blogs.slice(skip, skip + limit);
    } else if (locale === 'fr') {
      // For French: only show published blogs where title matches languages.fr.title
      const frQuery = Blog.find({ "languages.fr.title": { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
      const allBlogs = await (listProjection ? frQuery.select(listProjection) : frQuery);

      blogs = allBlogs.filter((blog: any) => {
        const mainTitle = blog.title?.trim();
        const frenchTitle = blog.languages?.fr?.title?.trim();
        return mainTitle && frenchTitle && mainTitle === frenchTitle;
      });

      total = blogs.length;
      blogs = blogs.slice(skip, skip + limit);
    } else if (locale === 'es') {
      // For Spanish: only show published blogs where title matches languages.es.title
      const esQuery = Blog.find({ "languages.es.title": { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
      const allBlogs = await (listProjection ? esQuery.select(listProjection) : esQuery);

      blogs = allBlogs.filter((blog: any) => {
        const mainTitle = blog.title?.trim();
        const spanishTitle = blog.languages?.es?.title?.trim();
        return mainTitle && spanishTitle && mainTitle === spanishTitle;
      });

      total = blogs.length;
      blogs = blogs.slice(skip, skip + limit);
    }

    // Localize the titles based on locale
    let localizedBlogs = getLocalizedDocuments(blogs, locale);

    // Remove content field if excludeContent is true (for list views)
    if (excludeContent) {
      localizedBlogs = localizedBlogs.map((blog: any) => {
        const blogCopy = { ...blog };
        delete blogCopy.content;
        // Also remove content from languages if it exists
        if (blogCopy.languages) {
          if (blogCopy.languages.fr) delete blogCopy.languages.fr.content;
          if (blogCopy.languages.es) delete blogCopy.languages.es.content;
        }
        return blogCopy;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        items: localizedBlogs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching blogs",
      error: error.message,
    });
  }
};

// ✅ Get Featured Blog
export const getFeaturedBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = (req.query.locale as string) || 'en';
    const excludeContent = req.query.excludeContent === 'true'; // Exclude content for list views
    const listProjection = excludeContent ? '-content -languages.fr.content -languages.es.content' : '';

    // Get all published featured blogs first
    const featuredQuery = Blog.find({ featured: true, published: true }).sort({ createdAt: -1 });
    const allFeaturedBlogs = await (listProjection ? featuredQuery.select(listProjection) : featuredQuery);

    let featuredBlog = null;

    if (locale === 'en') {
      // For English: find featured blog that is NOT French or Spanish
      featuredBlog = allFeaturedBlogs.find((blog: any) => {
        const mainTitle = blog.title?.trim();
        const frenchTitle = blog.languages?.fr?.title?.trim();
        const spanishTitle = blog.languages?.es?.title?.trim();

        // Exclude if main title matches French or Spanish title
        if (frenchTitle && mainTitle === frenchTitle) return false;
        if (spanishTitle && mainTitle === spanishTitle) return false;

        return true;
      });
    } else if (locale === 'fr') {
      // For French: find featured blog where title matches languages.fr.title
      featuredBlog = allFeaturedBlogs.find((blog: any) => {
        const mainTitle = blog.title?.trim();
        const frenchTitle = blog.languages?.fr?.title?.trim();
        return mainTitle && frenchTitle && mainTitle === frenchTitle;
      });
    } else if (locale === 'es') {
      // For Spanish: find featured blog where title matches languages.es.title
      featuredBlog = allFeaturedBlogs.find((blog: any) => {
        const mainTitle = blog.title?.trim();
        const spanishTitle = blog.languages?.es?.title?.trim();
        return mainTitle && spanishTitle && mainTitle === spanishTitle;
      });
    }

    // If no featured blog found for this locale, get the latest blog of that locale
    if (!featuredBlog) {
      let latestBlog = null;

      if (locale === 'en') {
        const latestEnQuery = Blog.find({ title: { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
        const allBlogs = await (listProjection ? latestEnQuery.select(listProjection) : latestEnQuery);
        latestBlog = allBlogs.find((blog: any) => {
          const mainTitle = blog.title?.trim();
          const frenchTitle = blog.languages?.fr?.title?.trim();
          const spanishTitle = blog.languages?.es?.title?.trim();
          if (frenchTitle && mainTitle === frenchTitle) return false;
          if (spanishTitle && mainTitle === spanishTitle) return false;
          return true;
        });
      } else if (locale === 'fr') {
        const latestFrQuery = Blog.find({ "languages.fr.title": { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
        const allBlogs = await (listProjection ? latestFrQuery.select(listProjection) : latestFrQuery);
        latestBlog = allBlogs.find((blog: any) => {
          const mainTitle = blog.title?.trim();
          const frenchTitle = blog.languages?.fr?.title?.trim();
          return mainTitle && frenchTitle && mainTitle === frenchTitle;
        });
      } else if (locale === 'es') {
        const latestEsQuery = Blog.find({ "languages.es.title": { $exists: true, $ne: "" }, published: true }).sort({ createdAt: -1 });
        const allBlogs = await (listProjection ? latestEsQuery.select(listProjection) : latestEsQuery);
        latestBlog = allBlogs.find((blog: any) => {
          const mainTitle = blog.title?.trim();
          const spanishTitle = blog.languages?.es?.title?.trim();
          return mainTitle && spanishTitle && mainTitle === spanishTitle;
        });
      }

      if (latestBlog) {
        let localizedLatest = getLocalizedDocument(latestBlog, locale);
        
        // Remove content if excludeContent is true
        if (excludeContent) {
          const latestCopy = { ...localizedLatest };
          delete latestCopy.content;
          if (latestCopy.languages) {
            if (latestCopy.languages.fr) delete latestCopy.languages.fr.content;
            if (latestCopy.languages.es) delete latestCopy.languages.es.content;
          }
          localizedLatest = latestCopy;
        }
        
        res.status(200).json({
          success: true,
          data: localizedLatest,
        });
        return;
      }
    }

    if (featuredBlog) {
      // Localize the title based on locale
      let localizedFeatured = getLocalizedDocument(featuredBlog, locale);
      
      // Remove content if excludeContent is true
      if (excludeContent) {
        const featuredCopy = { ...localizedFeatured };
        delete featuredCopy.content;
        if (featuredCopy.languages) {
          if (featuredCopy.languages.fr) delete featuredCopy.languages.fr.content;
          if (featuredCopy.languages.es) delete featuredCopy.languages.es.content;
        }
        localizedFeatured = featuredCopy;
      }
      
      res.status(200).json({
        success: true,
        data: localizedFeatured,
      });
    } else {
      res.status(200).json({
        success: true,
        data: null,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching featured blog",
      error: error.message,
    });
  }
};

// ✅ Get Blog by Slug or ID
export const getBlogByIdOrSlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;
    const locale = (req.query.locale as string) || 'en';
    const isAdminView = req.headers['x-admin-view'] === 'true' || req.query.admin === 'true';

    let blog = null;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      blog = await Blog.findById(idOrSlug);
    }

    if (!blog) {
      blog = await Blog.findOne({ slug: idOrSlug });
    }

    if (!blog) {
      res.status(404).json({ success: false, message: "Blog not found" });
      return;
    }

    // For public view, only show published blogs
    if (!isAdminView && !blog.published) {
      res.status(404).json({ success: false, message: "Blog not found" });
      return;
    }

    // For admin view, return full blog with all languages
    if (isAdminView) {
      const blogObject = blog.toObject ? blog.toObject() : blog;
      res.status(200).json({ success: true, data: blogObject });
      return;
    }

    // For public view, localize based on locale
    const blogObject = blog.toObject ? blog.toObject() : blog;
    const localizedBlog = {
      ...blogObject,
      title: blogObject.languages?.[locale as 'es' | 'fr']?.title || blogObject.title,
      excerpt: blogObject.languages?.[locale as 'es' | 'fr']?.excerpt || blogObject.excerpt,
      content: blogObject.languages?.[locale as 'es' | 'fr']?.content || blogObject.content,
    };

    res.status(200).json({ success: true, data: localizedBlog });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching blog", error: error.message });
  }
};

// ✅ Update Blog
export const updateBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;

    // Normalize SEO schema: if schema is a string, convert to { en: string }
    let updateData: any = { ...req.body };
    if (updateData.seo?.schema && typeof updateData.seo.schema === 'string') {
      updateData.seo = {
        ...updateData.seo,
        schema: { en: updateData.seo.schema }
      };
    }

    let blog = null;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      blog = await Blog.findByIdAndUpdate(idOrSlug, updateData, { new: true });
    }

    if (!blog) {
      blog = await Blog.findOneAndUpdate({ slug: idOrSlug }, updateData, { new: true });
    }

    if (!blog) {
      res.status(404).json({
        success: false,
        message: "Blog not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: blog,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating blog",
      error: error.message,
    });
  }
};

// ✅ Delete Blog
export const deleteBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;

    let blog = null;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      blog = await Blog.findById(idOrSlug);
    }

    if (!blog) {
      blog = await Blog.findOne({ slug: idOrSlug });
    }

    if (!blog) {
      res.status(404).json({
        success: false,
        message: "Blog not found",
      });
      return;
    }

    // Create notification before deleting
    await createNotification(
      "blog",
      "deleted",
      "Blog Deleted",
      `Blog "${blog.title}" has been deleted.`,
      String(blog._id)
    );

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      await Blog.findByIdAndDelete(idOrSlug);
    } else {
      await Blog.findOneAndDelete({ slug: idOrSlug });
    }

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting blog",
      error: error.message,
    });
  }
};