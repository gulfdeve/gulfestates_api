import { Request, Response } from "express";
import PagesContent from "../models/PagesContent.js";

export const getAllPagesContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = (req.query.locale as string) || "en";
    const validLocales = ["en", "fr", "es"];
    const finalLocale = validLocales.includes(locale) ? locale : "en";

    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.max(parseInt((req.query.limit as string) || "10", 10), 1);
    const skip = (page - 1) * limit;

    // Filter by locale - each locale has its own documents
    const [pagesContent, total] = await Promise.all([
      PagesContent.find({ locale: finalLocale }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      PagesContent.countDocuments({ locale: finalLocale }),
    ]);

    const data = pagesContent.map((page) => {
      const pageObj = page.toObject ? page.toObject() : page;
      return {
        _id: pageObj._id,
        pageType: pageObj.pageType,
        locale: pageObj.locale,
        title: pageObj.title || "",
        subtitle: pageObj.subtitle || undefined,
        bannerType: pageObj.bannerType,
        bannerUrl: pageObj.bannerUrl,
        createdAt: pageObj.createdAt,
        updatedAt: pageObj.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching pages content",
      error: error.message,
    });
  }
};

export const getPageContentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const pageContent = await PagesContent.findById(id);

    if (!pageContent) {
      res.status(404).json({
        success: false,
        message: "Page content not found",
      });
      return;
    }

    const pageObj = pageContent.toObject ? pageContent.toObject() : pageContent;

    res.status(200).json({
      success: true,
      data: {
        _id: pageObj._id,
        pageType: pageObj.pageType,
        locale: pageObj.locale,
        title: pageObj.title || "",
        subtitle: pageObj.subtitle || undefined,
        bannerType: pageObj.bannerType,
        bannerUrl: pageObj.bannerUrl,
        createdAt: pageObj.createdAt,
        updatedAt: pageObj.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching page content",
      error: error.message,
    });
  }
};

export const getPageContentByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageType } = req.params;
    const locale = (req.query.locale as string) || "en";
    const validLocales = ["en", "fr", "es"];
    const finalLocale = validLocales.includes(locale) ? locale : "en";

    // Find by pageType AND locale - each locale has its own document
    const pageContent = await PagesContent.findOne({ pageType, locale: finalLocale });

    if (!pageContent) {
      res.status(404).json({
        success: false,
        message: "Page content not found",
      });
      return;
    }

    const pageObj = pageContent.toObject ? pageContent.toObject() : pageContent;

    res.status(200).json({
      success: true,
      data: {
        _id: pageObj._id,
        pageType: pageObj.pageType,
        locale: pageObj.locale,
        title: pageObj.title || "",
        subtitle: pageObj.subtitle || undefined,
        bannerType: pageObj.bannerType,
        bannerUrl: pageObj.bannerUrl,
        createdAt: pageObj.createdAt,
        updatedAt: pageObj.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching page content",
      error: error.message,
    });
  }
};

export const createPageContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageType, locale, title, subtitle, bannerType, bannerUrl } = req.body;

    if (!pageType || !locale || !bannerType || !bannerUrl) {
      res.status(400).json({
        success: false,
        message: "Page type, locale, banner type, and banner URL are required",
      });
      return;
    }

    const validLocales = ["en", "fr", "es"];
    if (!validLocales.includes(locale)) {
      res.status(400).json({
        success: false,
        message: "Locale must be en, fr, or es",
      });
      return;
    }

    if (bannerType !== "image" && bannerType !== "video") {
      res.status(400).json({
        success: false,
        message: "Banner type must be either 'image' or 'video'",
      });
      return;
    }

    // Check if this pageType+locale combo already exists
    const existingPage = await PagesContent.findOne({ pageType, locale });
    if (existingPage) {
      res.status(400).json({
        success: false,
        message: `Page content for '${pageType}' in ${locale.toUpperCase()} already exists`,
      });
      return;
    }

    const pageContent = await PagesContent.create({
      pageType,
      locale,
      title: title || "",
      subtitle: subtitle || "",
      bannerType,
      bannerUrl,
    });

    res.status(201).json({
      success: true,
      message: "Page content created successfully",
      data: pageContent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating page content",
      error: error.message,
    });
  }
};

export const updatePageContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { pageType, title, subtitle, bannerType, bannerUrl } = req.body;

    const pageContent = await PagesContent.findById(id);

    if (!pageContent) {
      res.status(404).json({
        success: false,
        message: "Page content not found",
      });
      return;
    }

    if (pageType) {
      const existingPage = await PagesContent.findOne({
        pageType,
        locale: pageContent.locale,
        _id: { $ne: id },
      });
      if (existingPage) {
        res.status(400).json({
          success: false,
          message: `Page content with pageType '${pageType}' already exists for this locale`,
        });
        return;
      }
      pageContent.pageType = pageType;
    }

    if (title !== undefined) {
      pageContent.title = title || "";
    }

    if (subtitle !== undefined) {
      pageContent.subtitle = subtitle || "";
    }

    if (bannerType) {
      if (bannerType !== "image" && bannerType !== "video") {
        res.status(400).json({
          success: false,
          message: "Banner type must be either 'image' or 'video'",
        });
        return;
      }
      pageContent.bannerType = bannerType;
    }

    if (bannerUrl) {
      pageContent.bannerUrl = bannerUrl;
    }

    await pageContent.save();

    res.status(200).json({
      success: true,
      message: "Page content updated successfully",
      data: pageContent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating page content",
      error: error.message,
    });
  }
};

export const deletePageContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Delete by ID - only affects this specific locale document
    const pageContent = await PagesContent.findByIdAndDelete(id);

    if (!pageContent) {
      res.status(404).json({
        success: false,
        message: "Page content not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Page content deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting page content",
      error: error.message,
    });
  }
};
