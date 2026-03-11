import { Request, Response } from "express";
import Testimonial, { ITestimonial } from "../models/testimonial.model.js";
import { createNotification } from "./notification.controller.js";

/**
 * GET /api/testimonials
 * Get all testimonials (with optional locale filtering)
 */
export const getTestimonials = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = (req.query.locale as string) || "en";
    const featured = req.query.featured === "true";
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const isAdminView = req.headers['x-admin-view'] === 'true' || req.query.admin === 'true';

    let query: any = {};
    if (featured) {
      query.featured = true;
    }

    // Language-specific filtering: only show testimonials for the requested language
    // Each testimonial now has a locale field that determines its language
    // For backward compatibility, if locale is 'en', also include testimonials without locale field
    if (locale === 'en') {
      query.$or = [
        { locale: 'en' },
        { locale: { $exists: false } } // Include old testimonials without locale (default to English)
      ];
    } else {
      query.locale = locale;
    }

    let testimonials = await Testimonial.find(query)
      .sort({ createdAt: -1 })
      .limit(limit || 0);

    // For admin view, return full objects with all languages
    if (isAdminView) {
      const fullTestimonials = testimonials.map((testimonial) => {
        const testimonialObj = testimonial.toObject ? testimonial.toObject() : testimonial;
        return {
          id: testimonialObj._id,
          name: testimonialObj.name,
          role: testimonialObj.role,
          text: testimonialObj.text,
          rating: testimonialObj.rating,
          featured: testimonialObj.featured,
          languages: testimonialObj.languages || {},
          createdAt: testimonialObj.createdAt,
          updatedAt: testimonialObj.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        count: fullTestimonials.length,
        data: fullTestimonials,
      });
      return;
    }

    // For public view, testimonials are already filtered by locale
    // Each testimonial's main fields (role, text) are already in the correct language
    const localizedTestimonials = testimonials.map((testimonial) => {
      const testimonialObj = testimonial.toObject ? testimonial.toObject() : testimonial;
      return {
        id: testimonialObj._id,
        name: testimonialObj.name,
        role: testimonialObj.role,
        text: testimonialObj.text,
        rating: testimonialObj.rating,
        featured: testimonialObj.featured,
      };
    });

    res.status(200).json({
      success: true,
      count: localizedTestimonials.length,
      data: localizedTestimonials,
    });
  } catch (error: any) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching testimonials",
      error: error.message,
    });
  }
};

/**
 * GET /api/testimonials/:id
 * Get a single testimonial by ID
 */
export const getTestimonialById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const locale = (req.query.locale as string) || "en";
    const isAdminView = req.headers['x-admin-view'] === 'true' || req.query.admin === 'true';

    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
      return;
    }

    const testimonialObj = testimonial.toObject ? testimonial.toObject() : testimonial;

    // For admin view, return full testimonial with all languages
    if (isAdminView) {
      res.status(200).json({
        success: true,
        data: testimonialObj,
      });
      return;
    }

    // For public view, testimonial is already in the correct language
    // Check if the testimonial's locale matches the requested locale
    // For backward compatibility, testimonials without locale default to 'en'
    const testimonialLocale = testimonialObj.locale || 'en';
    if (testimonialLocale !== locale) {
      res.status(404).json({
        success: false,
        message: "Testimonial not found for this locale",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: testimonialObj._id,
        name: testimonialObj.name,
        role: testimonialObj.role,
        text: testimonialObj.text,
        rating: testimonialObj.rating,
        featured: testimonialObj.featured,
      },
    });
  } catch (error: any) {
    console.error("Error fetching testimonial:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching testimonial",
      error: error.message,
    });
  }
};

/**
 * POST /api/testimonials
 * Create a new testimonial (Protected)
 */
export const createTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, role, text, rating, languages, featured, locale } = req.body;
    const localeParam = locale || (req.query.locale as string) || 'en';

    // Validation
    if (!name || !role || !text || !rating) {
      res.status(400).json({
        success: false,
        message: "Name, role, text, and rating are required",
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    if (!['en', 'fr', 'es'].includes(localeParam)) {
      res.status(400).json({
        success: false,
        message: "Locale must be 'en', 'fr', or 'es'",
      });
      return;
    }

    const testimonial = await Testimonial.create({
      name,
      role,
      text,
      rating,
      locale: localeParam,
      languages: languages || {},
      featured: featured || false,
    });

    // Create notification
    await createNotification(
      "testimonial",
      "created",
      "New Testimonial Added",
      `A new testimonial from "${name}" has been added.`,
      testimonial._id.toString()
    );

    res.status(201).json({
      success: true,
      message: "Testimonial created successfully",
      data: testimonial,
    });
  } catch (error: any) {
    console.error("Error creating testimonial:", error);
    res.status(500).json({
      success: false,
      message: "Error creating testimonial",
      error: error.message,
    });
  }
};

/**
 * PUT /api/testimonials/:id
 * Update a testimonial (Protected)
 */
export const updateTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, text, rating, languages, featured, locale } = req.body;
    const localeParam = locale || (req.query.locale as string);

    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
      return;
    }

    // If locale is provided, ensure we're only updating testimonials of the same locale
    // For backward compatibility, testimonials without locale default to 'en'
    const testimonialLocale = testimonial.locale || 'en';
    if (localeParam && testimonialLocale !== localeParam) {
      res.status(403).json({
        success: false,
        message: `Cannot update testimonial. This testimonial belongs to locale '${testimonialLocale}', not '${localeParam}'`,
      });
      return;
    }

    // If updating and locale is provided, set it (for migrating old testimonials)
    if (localeParam && !testimonial.locale) {
      testimonial.locale = localeParam;
    }

    // Update fields if provided
    if (name) testimonial.name = name;
    if (role) testimonial.role = role;
    if (text) testimonial.text = text;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
        return;
      }
      testimonial.rating = rating;
    }
    if (languages) testimonial.languages = languages;
    if (featured !== undefined) testimonial.featured = featured;

    await testimonial.save();

    res.status(200).json({
      success: true,
      message: "Testimonial updated successfully",
      data: testimonial,
    });
  } catch (error: any) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({
      success: false,
      message: "Error updating testimonial",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/testimonials/:id
 * Delete a testimonial (Protected)
 * Supports language-specific deletion via ?locale=fr|es|en query parameter
 * Only deletes testimonials that match the specified locale
 */
export const deleteTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const locale = (req.query.locale as string) || null;

    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
      return;
    }

    // If locale is specified, only delete if it matches the testimonial's locale
    // For backward compatibility, testimonials without locale default to 'en'
    const testimonialLocale = testimonial.locale || 'en';
    if (locale) {
      if (testimonialLocale !== locale) {
        res.status(403).json({
          success: false,
          message: `Cannot delete testimonial. This testimonial belongs to locale '${testimonialLocale}', not '${locale}'`,
        });
        return;
      }
    }

    // Delete the testimonial (it's already verified to match the locale if provided)
    await createNotification(
      "testimonial",
      "deleted",
      "Testimonial Deleted",
      `Testimonial from "${testimonial.name}" (${testimonialLocale.toUpperCase()}) has been deleted.`,
      testimonial._id.toString()
    );

    await Testimonial.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Testimonial deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting testimonial",
      error: error.message,
    });
  }
};

