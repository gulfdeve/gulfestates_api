import { Request, Response } from "express";
import OffPlan from "../models/OffPlan.js";
import { isValidImageUrl, getFallbackImage } from "../utils/imageUtils.js";
import cloudinary from "../config/cloudinary.js";
import { downloadAndUploadImage, downloadAndUploadMultipleImages } from "../utils/imageDownloader.js";
import { translateToFrench, translateToSpanish, translateHtmlToFrench, translateHtmlToSpanish, delay } from "../utils/translation.util.js";
import { fixCloudinaryUrl, extractPublicIdFromUrl } from "../utils/cloudinary.util.js";
import escapeStringRegexp from "escape-string-regexp";

// Helper function to get localized field
const getLocalizedField = (field: any, locale: string = 'en') => {
  if (!field) return '';

  if (typeof field === 'object' && field[locale]) {
    return field[locale];
  }

  // Fallback to English if requested locale is not available
  if (typeof field === 'object' && field.en) {
    return field.en;
  }

  return field;
};

// Helper function to localize offplan
const localizeOffPlan = (offplan: any, locale: string = 'en') => {
  if (!offplan) return offplan;

  return {
    ...offplan.toObject ? offplan.toObject() : offplan,
    title: getLocalizedField(offplan.title, locale),
    description: getLocalizedField(offplan.description, locale),
    location: getLocalizedField(offplan.location, locale),
    // Keep the original language objects for forms/editing
    languages: {
      title: offplan.title,
      description: offplan.description,
      location: offplan.location
    }
  };
};

// Helper function to localize multiple offplans
const localizeOffPlans = (offplans: any[], locale: string = 'en') => {
  return offplans.map(offplan => localizeOffPlan(offplan, locale));
};

// Helper function to clean and format HTML description
const cleanDescription = (html: string): string => {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html
    // Remove cursor spans and invisible characters from rich text editors
    .replace(/<span[^>]*class="ql-cursor"[^>]*>.*?<\/span>/gi, '')
    .replace(/<span[^>]*class="ql-cursor"[^>]*\/?>/gi, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters

    // Remove empty headings
    .replace(/<h[1-6]><br\s*\/?><\/h[1-6]>/gi, '')
    .replace(/<h[1-6]>\s*<\/h[1-6]>/gi, '')
    .replace(/<h[1-6]><br><\/h[1-6]>/gi, '')

    // Remove empty paragraphs
    .replace(/<p><br\s*\/?><\/p>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p><br><\/p>/gi, '')

    // Convert <br> tags to newlines for better formatting
    .replace(/<br\s*\/?>/gi, '\n')

    // Normalize whitespace (but preserve intentional spacing)
    .replace(/\s+/g, ' ')
    .trim();

  // Ensure proper spacing between block elements
  cleaned = cleaned
    .replace(/<\/p>\s*<p>/gi, '</p>\n\n<p>')
    .replace(/<\/h[1-6]>\s*<p>/gi, '</h3>\n\n<p>')
    .replace(/<\/p>\s*<h[1-6]>/gi, '</p>\n\n<h3>')
    .replace(/<\/h[1-6]>\s*<h[1-6]>/gi, '</h3>\n\n<h3>');

  // Clean up any remaining formatting issues
  cleaned = cleaned
    .replace(/<strong>(.*?)<\/strong>/gi, '<strong>$1</strong>') // Normalize strong tags
    .replace(/&amp;/g, '&') // Fix encoded ampersands
    .replace(/&nbsp;/g, ' ') // Convert non-breaking spaces
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Remove excessive newlines (max 2)
    .trim();

  return cleaned;
};

// Get all offplans with enhanced filters
export const getAllOffPlans = async (req: Request, res: Response) => {
  try {
    const {
      locale = 'en',
      location,
      developer,
      type,
      for: forPurpose,
      handover,
      minPrice,
      maxPrice,
      title,
      bedrooms,
      status,
      featured,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const isAdmin = req.query.admin === 'true' || req.headers['x-admin-view'] === 'true';
    const excludeContent = req.query.excludeContent === 'true'; // Exclude description for list views
    const listProjection = excludeContent ? '-description' : '';
    const filter: Record<string, any> = {};

    // If admin request, skip language filtering and return all offplans
    if (!isAdmin) {
      // Language-specific filtering: only show items with content in the requested language
      // Similar to blog filtering - only show properties that have content in the requested language
      const localeString = typeof locale === 'string' ? locale : 'en';
      if (localeString === 'en') {
        // For English: show properties where title.en exists and is not empty
        // Exclude properties that only have French or Spanish titles
        filter["title.en"] = { $exists: true, $ne: "" };
        // Only show if English title exists (don't show French/Spanish-only properties)
      } else if (localeString === 'fr') {
        // For French: only show properties where title.fr exists and is not empty
        filter["title.fr"] = { $exists: true, $ne: "" };
      } else if (localeString === 'es') {
        // For Spanish: only show properties where title.es exists and is not empty
        filter["title.es"] = { $exists: true, $ne: "" };
      }
    }

    // Build filter conditions with language support
    if (location && typeof location === 'string') {
      const sanitizedLocation = escapeStringRegexp(location);
      filter.$or = [
        { "location.en": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.fr": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.es": { $regex: sanitizedLocation, $options: 'i' } }
      ];
    }

    if (developer && typeof developer === 'string') {
      const sanitizedDeveloper = escapeStringRegexp(developer);
      filter.developer = { $regex: sanitizedDeveloper, $options: 'i' };
    }
    if (type) filter.type = type;
    if (forPurpose && ['buy', 'rent'].includes(forPurpose as string)) {
      filter.for = forPurpose;
    }
    if (handover && typeof handover === 'string') {
      const sanitizedHandover = escapeStringRegexp(handover);
      filter.handover = { $regex: sanitizedHandover, $options: 'i' };
    }

    if (title && typeof title === 'string') {
      const sanitizedTitle = escapeStringRegexp(title);
      filter.$or = [
        { "title.en": { $regex: sanitizedTitle, $options: 'i' } },
        { "title.fr": { $regex: sanitizedTitle, $options: 'i' } },
        { "title.es": { $regex: sanitizedTitle, $options: 'i' } }
      ];
    }

    if (bedrooms && typeof bedrooms === 'string') {
      const sanitizedBedrooms = escapeStringRegexp(bedrooms);
      filter.bedRange = { $regex: sanitizedBedrooms, $options: 'i' };
    }
    if (status) filter.status = status;
    if (featured !== undefined) filter.featured = featured === 'true';

    // Build sort object
    const sort: Record<string, any> = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Admin-only: apply page/limit so dashboard requests respect limit (non-admin path unchanged below)
    if (isAdmin) {
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Total count: full matching count only (do not apply page/limit to count)
      const totalCount = await OffPlan.countDocuments(filter);
      console.log(`📝 Admin offplan request - total: ${totalCount}, page: ${pageNum}, limit: ${limitNum}`);

      const adminQuery = OffPlan.find(filter).sort(sort).skip(skip).limit(limitNum);
      let allOffplans = await (listProjection ? adminQuery.select(listProjection) : adminQuery);

      // Apply price filtering if needed (in-memory after pagination)
      if (minPrice || maxPrice) {
        allOffplans = allOffplans.filter((offplan) => {
          const priceStr = offplan.priceFrom?.toString() || "0";
          const priceNum = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
          const min = minPrice ? Number(minPrice.toString().replace(/[^0-9]/g, '')) : 0;
          const max = maxPrice ? Number(maxPrice.toString().replace(/[^0-9]/g, '')) : Number.MAX_SAFE_INTEGER;
          return priceNum >= min && priceNum <= max;
        });
      }

      // Localize the results
      const localizedOffplans = localizeOffPlans(allOffplans, locale as string);
      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: localizedOffplans,
        total: totalCount,
        page: pageNum,
        totalPages,
      });
      return;
    }

    // Calculate pagination for non-admin requests
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await OffPlan.countDocuments(filter);
    console.log(`📊 Total offplans matching filter: ${total}, Requested limit: ${limitNum}, Page: ${pageNum}`);

    // Get paginated results
    const offplansQuery = OffPlan.find(filter).sort(sort).skip(skip).limit(limitNum);
    let offplans = await (listProjection ? offplansQuery.select(listProjection) : offplansQuery);

    console.log(`✅ Returning ${offplans.length} offplans (after pagination)`);

    // Apply price filtering if needed
    if (minPrice || maxPrice) {
      offplans = offplans.filter((offplan) => {
        const priceStr = offplan.priceFrom?.toString() || "0";
        const priceNum = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
        const min = minPrice ? Number(minPrice.toString().replace(/[^0-9]/g, '')) : 0;
        const max = maxPrice ? Number(maxPrice.toString().replace(/[^0-9]/g, '')) : Number.MAX_SAFE_INTEGER;
        return priceNum >= min && priceNum <= max;
      });
    }

    // Localize the results
    const localizedOffplans = localizeOffPlans(offplans, locale as string);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: localizedOffplans,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Error fetching offplans:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Get single offplan by id with enhanced validation
export const getOffPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { locale = 'en' } = req.query;

    let offplan;

    // Check if id is a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isValidObjectId) {
      // Search by MongoDB _id
      offplan = await OffPlan.findById(id);
    } else {
      // Search by slug (try all languages: en, es, fr)
      offplan = await OffPlan.findOne({
        $or: [
          { 'slug.en': id },
          { 'slug.es': id },
          { 'slug.fr': id }
        ]
      });
    }

    if (!offplan) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Validate and ensure images array exists
    if (!offplan.images || offplan.images.length === 0) {
      offplan.images = [offplan.image];
    }

    // Validate all image URLs
    const validImages = offplan.images.filter((img: string) => isValidImageUrl(img));
    if (validImages.length === 0) {
      offplan.images = [getFallbackImage(offplan.type)];
      offplan.image = getFallbackImage(offplan.type);
    } else {
      offplan.images = validImages;
      if (!isValidImageUrl(offplan.image)) {
        offplan.image = validImages[0];
      }
    }

    const localizedOffplan = localizeOffPlan(offplan, locale as string);
    res.status(200).json({ success: true, data: localizedOffplan });
  } catch (err) {
    console.error("Error fetching offplan by ID or slug:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Create new offplan with enhanced validation
export const createOffPlan = async (req: Request, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Request body is empty" });
    }

    const {
      title,
      location,
      developer,
      type,
      for: forPurpose,
      handover,
      priceFrom,
      paymentPlan,
      image,
      images,
      projectStatus,
      rentDuration,
      ...rest
    } = req.body;

    let imageUrl = image || "";
    let additionalImages: string[] = [];
    let brochureUrl = "";

    // Handle file uploads with proper field names
    // Convert req.files array (from upload.any()) to object organized by fieldname
    let files: { [fieldname: string]: Express.Multer.File[] } = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file: Express.Multer.File) => {
        // Validate fieldname is allowed
        const allowedFields = ['image', 'images', 'brochure', 'qrImage'];
        if (!allowedFields.includes(file.fieldname)) {
          return; // Skip unknown fields
        }
        if (!files[file.fieldname]) {
          files[file.fieldname] = [];
        }
        files[file.fieldname].push(file);
      });
      
      // Validate file count limits and take first file if multiple are sent
      if (files.image && files.image.length > 1) {
        console.log("⚠️ Multiple main images received, using first one:", files.image.length);
        files.image = [files.image[0]]; // Take only the first image
      }
      if (files.images && files.images.length > 20) {
        return res.status(400).json({ success: false, message: "Maximum 20 additional images allowed" });
      }
      if (files.brochure && files.brochure.length > 1) {
        console.log("⚠️ Multiple brochure files received, using first one:", files.brochure.length);
        files.brochure = [files.brochure[0]]; // Take only the first brochure
      }
      if (files.qrImage && files.qrImage.length > 1) {
        console.log("⚠️ Multiple QR images received, using first one:", files.qrImage.length);
        files.qrImage = [files.qrImage[0]]; // Take only the first QR image
      }
    } else if (req.files) {
      files = req.files as { [fieldname: string]: Express.Multer.File[] };
    }
    
    if (Object.keys(files).length > 0) {
      // Handle main image (max 1MB)
      if (files.image && files.image[0]) {
        const mainImageFile = files.image[0];
        const MAX_MAIN_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
        if (mainImageFile.size > MAX_MAIN_IMAGE_SIZE) {
          return res.status(400).json({
            success: false,
            message: `Main image size exceeds 1MB limit. File size: ${(mainImageFile.size / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        imageUrl = mainImageFile.path;
        console.log("📸 OffPlan Main image uploaded:", imageUrl);
      }

      // Handle additional images (max 20 images, total max 15MB)
      if (files.images && files.images.length > 0) {
        const MAX_ADDITIONAL_IMAGES_COUNT = 20;
        const MAX_ADDITIONAL_IMAGES_SIZE = 15 * 1024 * 1024; // 15MB
        
        if (files.images.length > MAX_ADDITIONAL_IMAGES_COUNT) {
          return res.status(400).json({
            success: false,
            message: `Maximum ${MAX_ADDITIONAL_IMAGES_COUNT} additional images allowed. You uploaded ${files.images.length} images.`
          });
        }
        
        const totalSize = files.images.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > MAX_ADDITIONAL_IMAGES_SIZE) {
          return res.status(400).json({
            success: false,
            message: `Total size of all additional images exceeds 15MB limit. Total size: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        
        additionalImages = files.images.map(f => f.path);
        console.log("📸 OffPlan Additional images uploaded:", additionalImages.length);
      }

      // Handle brochure PDF upload for CREATE
      if (files.brochure && files.brochure[0]) {
        try {
          console.log("📤 Processing brochure PDF file upload (CREATE):", files.brochure[0].originalname, "Size:", files.brochure[0].size, "bytes");
          brochureUrl = files.brochure[0].path;
          console.log("✅ OffPlan Brochure uploaded to Cloudinary (CREATE):", brochureUrl);
        } catch (error) {
          console.error("❌ Error uploading brochure to Cloudinary:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload brochure PDF to Cloudinary"
          });
        }
      }

      // Handle QR image (max 1MB)
      if (files.qrImage && files.qrImage[0]) {
        const qrImageFile = files.qrImage[0];
        const MAX_QR_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
        if (qrImageFile.size > MAX_QR_IMAGE_SIZE) {
          return res.status(400).json({
            success: false,
            message: `QR image size exceeds 1MB limit. File size: ${(qrImageFile.size / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        const qrImageUrl = qrImageFile.path;
        console.log("📸 OffPlan QR image uploaded:", qrImageUrl);
        req.body.qrImage = qrImageUrl;
      }
    }

    // Fields are now optional, but validate 'for' field if provided

    // Validate 'for' field
    if (!['buy', 'rent'].includes(forPurpose)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 'for' field. Must be 'buy' or 'rent'"
      });
    }

    // Validate main image if provided as URL (not uploaded)
    if (imageUrl && !imageUrl.startsWith('data:image/') && !isValidImageUrl(imageUrl)) {
      return res.status(400).json({ success: false, message: "Invalid main image URL" });
    }

    // Validate additional images if provided as URLs (not uploaded)
    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (typeof img === 'string' && !img.startsWith('data:image/') && !isValidImageUrl(img)) {
          return res.status(400).json({ success: false, message: `Invalid image URL: ${img}` });
        }
      }
    }

    // Process images array first (needed for fallback)
    let finalImages: string[] = [];
    if (images) {
      try {
        const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
          finalImages = parsedImages.filter((img: any) => img && typeof img === 'string');
        } else if (typeof parsedImages === 'string') {
          finalImages = [parsedImages];
        }
      } catch (error) {
        console.log("⚠️ Could not parse images as JSON, treating as single URL:", images);
        if (typeof images === 'string') {
          finalImages = [images];
        }
      }
    }

    // Combine with uploaded images
    if (additionalImages.length > 0) {
      finalImages = [...finalImages, ...additionalImages];
    }

    // Fallback: If main image is missing, use first image from additional images
    if (!imageUrl || imageUrl.trim() === "") {
      if (finalImages.length > 0) {
        // Use first image from additional images as main image
        imageUrl = finalImages[0];
        // Remove it from additional images array
        finalImages = finalImages.slice(1);
        console.log("📸 Using first additional image as main image fallback:", imageUrl);
      } else {
        return res.status(400).json({
          success: false,
          message: "Main image is required. Please upload a main image (max 1MB) or at least one additional image."
        });
      }
    }

    const mainImage = imageUrl;

    // If no additional images, use main image as the only image
    if (finalImages.length === 0) {
      finalImages = [mainImage];
    }

    // Parse JSON fields if they come as strings
    const parseField = (field: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    // Parse amenities if provided
    let parsedAmenities: string[] = [];
    if (rest.amenities) {
      const amenitiesData = parseField(rest.amenities);
      if (Array.isArray(amenitiesData)) {
        // Filter out boolean values and keep only strings
        parsedAmenities = amenitiesData
          .filter((item: any) => typeof item === 'string' && item.trim() !== '')
          .map((item: any) => typeof item === 'string' ? item.trim() : item);
      }
    }

    // Parse SEO if provided
    let parsedSeo = undefined;
    if (rest.seo) {
      parsedSeo = parseField(rest.seo);
      // Normalize schema: if schema is a string, convert to { en: string }
      if (parsedSeo?.schema && typeof parsedSeo.schema === 'string') {
        parsedSeo = {
          ...parsedSeo,
          schema: { en: parsedSeo.schema }
        };
      }
    }

    // Parse geoLocation if provided
    let parsedGeoLocation = undefined;
    if (rest.geoLocation) {
      parsedGeoLocation = parseField(rest.geoLocation);
    }

    // Parse description if provided
    let parsedDescription = undefined;
    if (rest.description) {
      parsedDescription = parseField(rest.description);
    }

    // Remove seo, amenities, geoLocation, and description from rest to avoid duplication
    const { seo, amenities, geoLocation, description, ...otherRest } = rest;

    // For CREATE: Only use uploaded brochure file (uploaded to Cloudinary)
    // Don't accept brochure URL from body in create mode - only file uploads
    const finalBrochure = brochureUrl || "";

    // Get QR image URL from body (already set if uploaded)
    const qrImageUrl = req.body.qrImage || "";

    // Get DLD Permit Number from body
    const dldPermitNumber = req.body.dldPermitNumber || "";

    const offplanData: any = {
      ...(title && { title: parseField(title) }),
      ...(location && { location: parseField(location) }),
      ...(developer && { developer }),
      ...(type && { type }),
      for: forPurpose || 'buy',
      ...(handover && { handover }),
      ...(priceFrom && { priceFrom }),
      ...(paymentPlan && { paymentPlan }),
      image: mainImage,
      images: finalImages,
      ...(parsedDescription && { description: parsedDescription }),
      ...(parsedAmenities.length > 0 && { amenities: parsedAmenities }),
      ...(parsedSeo && { seo: parsedSeo }),
      ...(parsedGeoLocation && { geoLocation: parsedGeoLocation }),
      ...(finalBrochure && { brochure: finalBrochure }),
      ...(qrImageUrl && { qrImage: qrImageUrl }),
      ...(dldPermitNumber && { dldPermitNumber }),
      ...(projectStatus && { projectStatus }),
      ...(forPurpose === 'rent' && rentDuration ? { rentDuration } : {}),
      ...otherRest
    };

    const newOffPlan = await OffPlan.create(offplanData);
    res.status(201).json({ success: true, data: newOffPlan });
  } catch (err: unknown) {
    console.error("Error creating offplan:", err);

    // Handle Mongoose validation errors
    if (err instanceof Error && err.name === 'ValidationError') {
      const validationError = err as any;
      const errors = Object.values(validationError.errors).map((e: any) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Handle duplicate key errors
    if (err instanceof Error && 'code' in err && (err as any).code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Off-plan with similar details already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'An unknown error occurred'
    });
  }
};

// Update offplan
export const updateOffPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const offplan = await OffPlan.findById(id);
    if (!offplan) {
      return res.status(404).json({ success: false, message: "Off-plan not found" });
    }

    let updateData: any = { ...req.body };
    // IMPORTANT: Remove brochure from updateData initially to avoid conflicts
    // We'll set it explicitly after handling file uploads
    delete updateData.brochure;

    // Handle file uploads
    // Convert req.files array (from upload.any()) to object organized by fieldname
    let files: { [fieldname: string]: Express.Multer.File[] } = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file: Express.Multer.File) => {
        // Validate fieldname is allowed
        const allowedFields = ['image', 'images', 'brochure', 'qrImage'];
        if (!allowedFields.includes(file.fieldname)) {
          return; // Skip unknown fields
        }
        if (!files[file.fieldname]) {
          files[file.fieldname] = [];
        }
        files[file.fieldname].push(file);
      });
      
      // Validate file count limits and take first file if multiple are sent
      if (files.image && files.image.length > 1) {
        console.log("⚠️ Multiple main images received, using first one:", files.image.length);
        files.image = [files.image[0]]; // Take only the first image
      }
      if (files.images && files.images.length > 20) {
        return res.status(400).json({ success: false, message: "Maximum 20 additional images allowed" });
      }
      if (files.brochure && files.brochure.length > 1) {
        console.log("⚠️ Multiple brochure files received, using first one:", files.brochure.length);
        files.brochure = [files.brochure[0]]; // Take only the first brochure
      }
      if (files.qrImage && files.qrImage.length > 1) {
        console.log("⚠️ Multiple QR images received, using first one:", files.qrImage.length);
        files.qrImage = [files.qrImage[0]]; // Take only the first QR image
      }
    } else if (req.files) {
      files = req.files as { [fieldname: string]: Express.Multer.File[] };
    }
    
    if (Object.keys(files).length > 0) {
      // Handle main image upload (max 1MB)
      if (files.image && files.image[0]) {
        const mainImageFile = files.image[0];
        const MAX_MAIN_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
        if (mainImageFile.size > MAX_MAIN_IMAGE_SIZE) {
          return res.status(400).json({
            success: false,
            message: `Main image size exceeds 1MB limit. File size: ${(mainImageFile.size / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        updateData.image = mainImageFile.path;
        console.log("📸 OffPlan Main image uploaded:", updateData.image);
      }

      // Handle additional images upload (max 20 images, total max 15MB)
      if (files.images && files.images.length > 0) {
        const MAX_ADDITIONAL_IMAGES_COUNT = 20;
        const MAX_ADDITIONAL_IMAGES_SIZE = 15 * 1024 * 1024; // 15MB
        
        if (files.images.length > MAX_ADDITIONAL_IMAGES_COUNT) {
          return res.status(400).json({
            success: false,
            message: `Maximum ${MAX_ADDITIONAL_IMAGES_COUNT} additional images allowed. You uploaded ${files.images.length} images.`
          });
        }
        
        const totalSize = files.images.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > MAX_ADDITIONAL_IMAGES_SIZE) {
          return res.status(400).json({
            success: false,
            message: `Total size of all additional images exceeds 15MB limit. Total size: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        
        const uploadedImages = files.images.map(f => f.path);
        console.log("📸 OffPlan Additional images uploaded:", uploadedImages.length);

        // Merge with existing images if any
        const existingImages = updateData.images
          ? (typeof updateData.images === 'string' ? JSON.parse(updateData.images) : updateData.images)
          : (offplan.images || []);

        updateData.images = [...existingImages, ...uploadedImages];
      }

      // Handle brochure PDF upload - File upload takes highest priority
      if (files.brochure && files.brochure[0]) {
        try {
          console.log("📤 Processing brochure PDF file upload:", files.brochure[0].originalname, "Size:", files.brochure[0].size, "bytes");
          const brochureUrl = files.brochure[0].path;
          updateData.brochure = brochureUrl;
          console.log("✅ OffPlan Brochure uploaded to Cloudinary and URL saved:", brochureUrl);
        } catch (error) {
          console.error("❌ Error uploading brochure to Cloudinary:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload brochure PDF to Cloudinary"
          });
        }
      } else {
        // No file upload - check if brochure URL is in body (for existing URLs in edit mode)
        if (req.body.brochure !== undefined && typeof req.body.brochure === 'string') {
          updateData.brochure = req.body.brochure.trim();
          console.log("📄 OffPlan Brochure URL from body (no file upload, using existing URL):", updateData.brochure || "(empty - clearing brochure)");
        } else if (offplan.brochure) {
          // Keep existing brochure if no new one provided and no URL in body
          updateData.brochure = offplan.brochure;
          console.log("📄 Keeping existing OffPlan brochure (no changes):", updateData.brochure);
        }
      }

      // Handle QR image upload (max 1MB)
      if (files.qrImage && files.qrImage[0]) {
        try {
          const qrImageFile = files.qrImage[0];
          const MAX_QR_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
          if (qrImageFile.size > MAX_QR_IMAGE_SIZE) {
            return res.status(400).json({
              success: false,
              message: `QR image size exceeds 1MB limit. File size: ${(qrImageFile.size / (1024 * 1024)).toFixed(2)}MB`
            });
          }
          const qrImageUrl = qrImageFile.path;
          updateData.qrImage = qrImageUrl;
          console.log("✅ OffPlan QR image uploaded to Cloudinary:", qrImageUrl);
        } catch (error) {
          console.error("❌ Error uploading QR image to Cloudinary:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload QR image to Cloudinary"
          });
        }
      } else {
        // No file upload - check if QR image URL is in body (for existing URLs)
        if (req.body.qrImage && typeof req.body.qrImage === 'string' && req.body.qrImage.trim() !== '') {
          updateData.qrImage = req.body.qrImage.trim();
          console.log("📸 OffPlan QR image URL from body (no file upload):", updateData.qrImage);
        } else if (offplan.qrImage) {
          // Keep existing QR image if no new one provided
          updateData.qrImage = offplan.qrImage;
          console.log("📸 Keeping existing QR image:", updateData.qrImage);
        }
      }
    } else {
      // No files at all - use brochure from body if provided (including empty string to clear), otherwise keep existing
      if (req.body.brochure !== undefined && typeof req.body.brochure === 'string') {
        updateData.brochure = req.body.brochure.trim();
        console.log("📄 OffPlan Brochure URL from body (no files):", updateData.brochure || "(empty - clearing brochure)");
      } else if (offplan.brochure) {
        updateData.brochure = offplan.brochure;
        console.log("📄 Keeping existing brochure (no files):", updateData.brochure);
      }
      // Handle QR image from body if no files
      if (req.body.qrImage && typeof req.body.qrImage === 'string' && req.body.qrImage.trim() !== '') {
        updateData.qrImage = req.body.qrImage.trim();
        console.log("📸 OffPlan QR image URL from body (no files):", updateData.qrImage);
      } else if (offplan.qrImage) {
        updateData.qrImage = offplan.qrImage;
        console.log("📸 Keeping existing QR image (no files):", updateData.qrImage);
      }
    }

    // Fallback: If main image is missing, check existing offplan image or additional images
    if (!updateData.image) {
      if (offplan.image) {
        updateData.image = offplan.image;
        console.log("📸 Keeping existing offplan image:", updateData.image);
      } else {
        // Parse images if it's a string
        let parsedImages: string[] = [];
        if (updateData.images) {
          if (typeof updateData.images === 'string') {
            try {
              parsedImages = JSON.parse(updateData.images);
            } catch {
              parsedImages = [updateData.images];
            }
          } else if (Array.isArray(updateData.images)) {
            parsedImages = updateData.images;
          }
        }
        
        if (parsedImages.length > 0) {
          updateData.image = parsedImages[0];
          updateData.images = parsedImages.slice(1);
          console.log("📸 Using first additional image as main image fallback:", updateData.image);
        } else if (offplan.images && Array.isArray(offplan.images) && offplan.images.length > 0) {
          updateData.image = offplan.images[0];
          console.log("📸 Using first existing image as main image fallback:", updateData.image);
        }
      }
    }

    // Handle DLD Permit Number
    if (req.body.dldPermitNumber !== undefined) {
      updateData.dldPermitNumber = req.body.dldPermitNumber || "";
    }

    // Handle projectStatus
    if (req.body.projectStatus !== undefined) {
      updateData.projectStatus = req.body.projectStatus || "";
    }
    if (req.body.rentDuration !== undefined) {
      updateData.rentDuration = req.body.rentDuration || "";
    }

    const effectiveFor = updateData.for || offplan.for;
    if (effectiveFor !== 'rent' || updateData.rentDuration === "") {
      delete updateData.rentDuration;
    }

    // Validate images if provided as URLs (not uploaded)
    const isValidImage = (url: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      // Accept data URLs (base64 images)
      if (url.startsWith('data:image/')) return true;
      // Accept HTTP/HTTPS URLs
      try {
        const parsedUrl = new URL(url);
        return /^https?:$/.test(parsedUrl.protocol);
      } catch {
        return false;
      }
    };

    if (updateData.image && typeof updateData.image === 'string' && !updateData.image.startsWith('data:image/') && !isValidImage(updateData.image)) {
      return res.status(400).json({ success: false, message: "Invalid main image URL" });
    }

    if (updateData.images && Array.isArray(updateData.images)) {
      for (const img of updateData.images) {
        if (typeof img === 'string' && !img.startsWith('data:image/') && !isValidImage(img)) {
          return res.status(400).json({ success: false, message: `Invalid image URL: ${img}` });
        }
      }
    }

    // Parse JSON fields
    const parseField = (field: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    // Parse specific fields that might be JSON
    if (updateData.title) updateData.title = parseField(updateData.title);
    if (updateData.location) updateData.location = parseField(updateData.location);
    // Merge title/location with existing for partial updates (FR/ES-only edits)
    if (updateData.title && typeof updateData.title === 'object') {
      const existingTitle = (offplan as any).title && typeof (offplan as any).title === 'object' ? (offplan as any).title : {};
      updateData.title = { ...existingTitle, ...updateData.title };
    }
    if (updateData.location && typeof updateData.location === 'object') {
      const existingLocation = (offplan as any).location && typeof (offplan as any).location === 'object' ? (offplan as any).location : {};
      updateData.location = { ...existingLocation, ...updateData.location };
    }
    if (updateData.description) updateData.description = parseField(updateData.description);
    if (updateData.seo) {
      updateData.seo = parseField(updateData.seo);
      // Normalize schema: if schema is a string, convert to { en: string }
      if (updateData.seo?.schema && typeof updateData.seo.schema === 'string') {
        updateData.seo = {
          ...updateData.seo,
          schema: { en: updateData.seo.schema }
        };
      }
    }
    if (updateData.geoLocation) updateData.geoLocation = parseField(updateData.geoLocation);
    
    // Parse amenities if provided
    if (updateData.amenities) {
      const amenitiesData = parseField(updateData.amenities);
      if (Array.isArray(amenitiesData)) {
        // Filter out boolean values and keep only strings
        updateData.amenities = amenitiesData
          .filter((item: any) => typeof item === 'string' && item.trim() !== '')
          .map((item: any) => typeof item === 'string' ? item.trim() : item);
      } else {
        // If not an array after parsing, set to empty array
        updateData.amenities = [];
      }
    }

    // Process images array if it's a string
    if (updateData.images && typeof updateData.images === 'string') {
      try {
        updateData.images = JSON.parse(updateData.images);
      } catch {
        // If parsing fails, keep as is
      }
    }

    // Ensure images is always an array
    if (updateData.images && !Array.isArray(updateData.images)) {
      updateData.images = [updateData.images];
    }

    // Ensure image is always a string (not an array)
    // If image comes as an array, take the first element
    if (updateData.image && Array.isArray(updateData.image)) {
      console.log("⚠️  Image field received as array, converting to string (taking first element)");
      updateData.image = updateData.image[0];
    }
    // If image is a string that looks like JSON array, parse it
    if (updateData.image && typeof updateData.image === 'string' && updateData.image.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(updateData.image);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("⚠️  Image field received as JSON array string, converting to string (taking first element)");
          updateData.image = parsed[0];
        }
      } catch {
        // If parsing fails, keep as is
      }
    }

    // Validate that image exists (either new upload, existing, or fallback from additional images)
    let finalImage = updateData.image || offplan.image;
    
    // Fallback: If still no image, try to get from additional images
    if (!finalImage || finalImage.trim() === "") {
      // Parse images if it's a string
      let parsedImages: string[] = [];
      if (updateData.images) {
        if (typeof updateData.images === 'string') {
          try {
            parsedImages = JSON.parse(updateData.images);
          } catch {
            parsedImages = [updateData.images];
          }
        } else if (Array.isArray(updateData.images)) {
          parsedImages = updateData.images;
        }
      }
      
      if (parsedImages.length > 0) {
        finalImage = parsedImages[0];
        updateData.image = finalImage;
        updateData.images = parsedImages.slice(1);
        console.log("📸 Using first additional image as main image fallback in final validation:", finalImage);
      } else if (offplan.images && Array.isArray(offplan.images) && offplan.images.length > 0) {
        finalImage = offplan.images[0];
        updateData.image = finalImage;
        console.log("📸 Using first existing image as main image fallback in final validation:", finalImage);
      }
    }
    
    if (!finalImage || finalImage.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Main image is required. Please upload a main image (max 1MB) or at least one additional image."
      });
    }
    
    // Ensure updateData.image is set to the final image
    updateData.image = finalImage;

    // Validate required fields - allow FR/ES-only for multilingual editing (at least one lang required)
    const hasTitle = updateData.title && (
      (updateData.title.en && typeof updateData.title.en === 'string' && updateData.title.en.trim()) ||
      (updateData.title.fr && typeof updateData.title.fr === 'string' && updateData.title.fr.trim()) ||
      (updateData.title.es && typeof updateData.title.es === 'string' && updateData.title.es.trim())
    );
    if (updateData.title && !hasTitle) {
      return res.status(400).json({ success: false, message: "Title is required in at least one language (English, French, or Spanish)" });
    }
    const hasLocation = updateData.location && (
      (updateData.location.en && typeof updateData.location.en === 'string' && updateData.location.en.trim()) ||
      (updateData.location.fr && typeof updateData.location.fr === 'string' && updateData.location.fr.trim()) ||
      (updateData.location.es && typeof updateData.location.es === 'string' && updateData.location.es.trim())
    );
    if (updateData.location && !hasLocation) {
      return res.status(400).json({ success: false, message: "Location is required in at least one language (English, French, or Spanish)" });
    }
    if (updateData.developer && (!updateData.developer.trim())) {
      return res.status(400).json({ success: false, message: "Developer is required and cannot be empty" });
    }
    if (updateData.type && !['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex'].includes(updateData.type)) {
      return res.status(400).json({ success: false, message: "Invalid type. Must be one of: Apartment, Villa, Townhouse, Penthouse, Duplex" });
    }
    if (updateData.for && !['buy', 'rent'].includes(updateData.for)) {
      return res.status(400).json({ success: false, message: "Invalid 'for' field. Must be 'buy' or 'rent'" });
    }

    // Remove undefined fields and empty strings (except for brochure which can be empty string)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
      // Remove empty strings except for brochure (which can be explicitly set to empty)
      if (updateData[key] === '' && key !== 'brochure') {
        delete updateData[key];
      }
    });

    // Log the update data for debugging
    console.log("🔍 DEBUG - OffPlan Final update data:", JSON.stringify(updateData, null, 2));
    console.log("🔍 DEBUG - Brochure field in updateData:", updateData.brochure);

    // Update the document properties
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        (offplan as any)[key] = updateData[key];
      }
    });

    // Mark modified fields to ensure they're saved
    if (updateData.title) offplan.markModified('title');
    if (updateData.location) offplan.markModified('location');
    if (updateData.description) offplan.markModified('description');
    if (updateData.seo) offplan.markModified('seo');
    if (updateData.amenities) offplan.markModified('amenities');
    if (updateData.images) offplan.markModified('images');
    if (updateData.geoLocation) offplan.markModified('geoLocation');
    if (updateData.brochure !== undefined) offplan.markModified('brochure');
    if (updateData.qrImage !== undefined) offplan.markModified('qrImage');
    if (updateData.dldPermitNumber !== undefined) offplan.markModified('dldPermitNumber');
    if (updateData.projectStatus !== undefined) offplan.markModified('projectStatus');
    if (updateData.rentDuration !== undefined) offplan.markModified('rentDuration');

    // Save the document - this will trigger pre-save hooks and regenerate slugs
    const updatedOffPlan = await offplan.save();

    if (!updatedOffPlan) {
      return res.status(404).json({ success: false, message: "Off-plan not found" });
    }

    res.status(200).json({ success: true, data: updatedOffPlan });
  } catch (err: unknown) {
    console.error("Error updating offplan:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));

    if (err instanceof Error && err.name === 'ValidationError') {
      const validationError = err as any;
      const errors = Object.values(validationError.errors).map((e: any) => e.message);
      console.error("Validation errors:", errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Handle CastError (invalid ID format)
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid off-plan ID format"
      });
    }

    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    console.error("Update error message:", errorMessage);
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// Delete offplan
/**
 * DELETE /api/offplans/:id
 * Delete an off-plan (Protected)
 * Always deletes the entire off-plan document
 */
export const deleteOffPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Delete off-plan request: id=${id}`);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const offPlan = await OffPlan.findById(id);

    if (!offPlan) {
      console.log(`❌ Off-plan not found: ${id}`);
      return res.status(404).json({ success: false, message: "Off-plan not found" });
    }

    console.log(`✅ Off-plan found: ${id}, title:`, offPlan.title);

    // Delete entire off-plan document first
    console.log(`🗑️ Deleting entire off-plan: ${id}`);

    const deletedOffPlan = await OffPlan.findByIdAndDelete(id);
    if (!deletedOffPlan) {
      console.log(`❌ Failed to delete off-plan: ${id}`);
      return res.status(404).json({ success: false, message: "Off-plan not found" });
    }

    // Verify deletion
    const verifyDeleted = await OffPlan.findById(id);
    if (verifyDeleted) {
      console.log(`❌ Off-plan still exists after deletion attempt: ${id}`);
      return res.status(500).json({
        success: false,
        message: "Failed to delete off-plan. Please try again."
      });
    }

    console.log(`✅ Successfully deleted off-plan: ${id}`);
    res.status(200).json({
      success: true,
      message: "Off-plan deleted successfully",
      data: deletedOffPlan
    });
  } catch (err: unknown) {
    console.error("Error deleting offplan:", err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'An unknown error occurred'
    });
  }
};

// Get similar offplans with enhanced logic
export const getSimilarOffPlans = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 3, locale = 'en', excludeCurrent = 'true' } = req.query;

    // Check if id is a valid MongoDB ObjectId or a slug
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let current;
    if (isValidObjectId) {
      // If it's a valid ObjectId, find by ID
      current = await OffPlan.findById(id);
    } else {
      // If it's not a valid ObjectId, try to find by slug (en, es, or fr)
      current = await OffPlan.findOne({
        $or: [
          { 'slug.en': id },
          { 'slug.es': id },
          { 'slug.fr': id }
        ]
      });
    }

    if (!current) {
      return res.status(404).json({ success: false, message: "Off-plan not found" });
    }

    const filter: Record<string, any> = {};

    if (excludeCurrent === 'true') {
      // Exclude the current off-plan by its _id
      filter._id = { $ne: current._id };
    }

    // Match by 'for' field if available
    if (current.for) {
      filter.for = current.for;
    }

    // Enhanced similarity logic - prioritize by location, then developer, then type
    const sanitizedLocationEn = current.location?.en ? escapeStringRegexp(current.location.en) : "";
    const sanitizedDeveloper = current.developer ? escapeStringRegexp(current.developer) : "";
    
    filter.$or = [
      {
        "location.en": { $regex: sanitizedLocationEn, $options: "i" },
        developer: { $regex: sanitizedDeveloper, $options: "i" }
      },
      {
        "location.en": { $regex: sanitizedLocationEn, $options: "i" }
      },
      {
        developer: { $regex: sanitizedDeveloper, $options: "i" }
      },
      {
        type: current.type
      }
    ];

    const sort: Record<string, 1 | -1> = {
      createdAt: -1
    };

    // Add conditional sorting based on location and developer matches
    if (current.location) {
      sort["location.en"] = 1;
    }
    if (current.developer) {
      sort.developer = 1;
    }

    const excludeContent = req.query.excludeContent === 'true';
    const simProjection = excludeContent ? '-description' : '';
    const simQuery = OffPlan.find(filter).sort(sort).limit(Number(limit));
    const similar = await (simProjection ? simQuery.select(simProjection) : simQuery);

    // Validate images for similar properties
    const validatedSimilar = similar.map(offplan => {
      if (!offplan.images || offplan.images.length === 0) {
        offplan.images = [offplan.image];
      }

      const validImages = offplan.images.filter((img: string) => isValidImageUrl(img));
      if (validImages.length === 0) {
        offplan.images = [getFallbackImage(offplan.type)];
        offplan.image = getFallbackImage(offplan.type);
      }

      return offplan;
    });

    const localized = localizeOffPlans(validatedSimilar, locale as string);
    res.status(200).json({ success: true, data: localized });
  } catch (err) {
    console.error("Error fetching similar offplans:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Get featured offplans
export const getFeaturedOffPlans = async (req: Request, res: Response) => {
  try {
    const { locale = 'en', limit = 6, for: forPurpose } = req.query;

    const filter: Record<string, any> = {
      featured: true,
      status: { $in: ['Available', 'Coming Soon'] }
    };

    // Filter by 'for' field if provided
    if (forPurpose && ['buy', 'rent'].includes(forPurpose as string)) {
      filter.for = forPurpose;
    }

    const excludeContent = req.query.excludeContent === 'true';
    const featProjection = excludeContent ? '-description' : '';
    const featQuery = OffPlan.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    const offplans = await (featProjection ? featQuery.select(featProjection) : featQuery);

    // Validate images
    const validatedOffplans = offplans.map(offplan => {
      if (!offplan.images || offplan.images.length === 0) {
        offplan.images = [offplan.image];
      }

      const validImages = offplan.images.filter((img: string) => isValidImageUrl(img));
      if (validImages.length === 0) {
        offplan.images = [getFallbackImage(offplan.type)];
        offplan.image = getFallbackImage(offplan.type);
      }

      return offplan;
    });

    const localizedOffplans = localizeOffPlans(validatedOffplans, locale as string);

    res.status(200).json({ success: true, data: localizedOffplans });
  } catch (err) {
    console.error("Error fetching featured offplans:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Search offplans with advanced filtering
export const searchOffPlans = async (req: Request, res: Response) => {
  try {
    const {
      locale = 'en',
      q, // search query
      location,
      developer,
      type,
      for: forPurpose,
      minPrice,
      maxPrice,
      bedrooms,
      status,
      page = 1,
      limit = 12
    } = req.query;

    const filter: Record<string, any> = {};

    // Text search across multiple fields with language support
    if (q && typeof q === 'string') {
      const sanitizedQ = escapeStringRegexp(q);
      filter.$or = [
        { "title.en": { $regex: sanitizedQ, $options: 'i' } },
        { "title.fr": { $regex: sanitizedQ, $options: 'i' } },
        { "title.es": { $regex: sanitizedQ, $options: 'i' } },
        { "location.en": { $regex: sanitizedQ, $options: 'i' } },
        { "location.fr": { $regex: sanitizedQ, $options: 'i' } },
        { "location.es": { $regex: sanitizedQ, $options: 'i' } },
        { developer: { $regex: sanitizedQ, $options: 'i' } },
        { "description.en": { $regex: sanitizedQ, $options: 'i' } }
      ];
    }

    // Additional filters with language support for location
    if (location && typeof location === 'string') {
      const sanitizedLocation = escapeStringRegexp(location);
      filter.$or = [
        { "location.en": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.fr": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.es": { $regex: sanitizedLocation, $options: 'i' } }
      ];
    }

    if (developer && typeof developer === 'string') {
      const sanitizedDeveloper = escapeStringRegexp(developer);
      filter.developer = { $regex: sanitizedDeveloper, $options: 'i' };
    }
    if (type) filter.type = type;
    if (forPurpose && ['buy', 'rent'].includes(forPurpose as string)) {
      filter.for = forPurpose;
    }
    if (bedrooms && typeof bedrooms === 'string') {
      const sanitizedBedrooms = escapeStringRegexp(bedrooms);
      filter.bedRange = { $regex: sanitizedBedrooms, $options: 'i' };
    }
    if (status) filter.status = status;

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const total = await OffPlan.countDocuments(filter);
    let offplans = await OffPlan.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Price filtering
    if (minPrice || maxPrice) {
      offplans = offplans.filter((offplan) => {
        const priceStr = offplan.priceFrom?.toString() || "0";
        const priceNum = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
        const min = minPrice ? Number(minPrice.toString().replace(/[^0-9]/g, '')) : 0;
        const max = maxPrice ? Number(maxPrice.toString().replace(/[^0-9]/g, '')) : Number.MAX_SAFE_INTEGER;
        return priceNum >= min && priceNum <= max;
      });
    }

    const localizedOffplans = localizeOffPlans(offplans, locale as string);
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: localizedOffplans,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Error searching offplans:", err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ===========================
// SYNC OFFPLANS FROM EXTERNAL API
// ===========================
export const syncOffPlansFromExternalAPI = async (req: Request, res: Response) => {
  try {
    console.log(`🚀 Sync endpoint called: /api/offplans/sync`);
    const { page = 1, lang = 'en-US' } = req.query;

    // Allow external API URL to be configured via environment variable
    const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE_URL || 'https://gulfestates.ae';
    const EXTERNAL_API_PATH = process.env.EXTERNAL_API_PATH || '/api/offplans';
    const externalApiUrl = `${EXTERNAL_API_BASE}${EXTERNAL_API_PATH}?page=${page}&lang=${lang}`;

    console.log(`🔄 Fetching offplans from external API: ${externalApiUrl}`);
    console.log(`📝 Using base URL: ${EXTERNAL_API_BASE}, path: ${EXTERNAL_API_PATH}`);

    // Fetch data from external API using Node.js fetch
    const response = await fetch(externalApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`❌ External API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text().catch(() => 'Unknown error');

      // Check if response is HTML (404 page)
      const isHtmlResponse = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html');

      if (isHtmlResponse) {
        console.error(`❌ External API returned HTML (404 page) - endpoint may not exist`);
        console.error(`❌ Attempted URL: ${externalApiUrl}`);
        return res.status(404).json({
          success: false,
          message: `External API endpoint not found (404). The endpoint may not exist or the URL is incorrect.`,
          attemptedUrl: externalApiUrl,
          suggestion: 'Please verify the external API endpoint URL. It might be: /api/offplans, /offplans, or a different path.'
        });
      }

      console.error(`❌ Error details:`, errorText.substring(0, 200));
      return res.status(response.status).json({
        success: false,
        message: `Failed to fetch from external API: ${response.status} ${response.statusText}`,
        attemptedUrl: externalApiUrl,
        error: errorText.substring(0, 500) // Limit error text length
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError: any) {
      console.error(`❌ Failed to parse JSON response from external API:`, parseError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse response from external API',
        error: parseError.message
      });
    }

    if (!data || !data.success || !data.offplans) {
      console.error(`❌ Invalid API response structure:`, {
        hasData: !!data,
        hasSuccess: data?.success,
        hasOffplans: !!data?.offplans,
        offplansLength: data?.offplans?.length
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid response from external API',
        details: {
          hasData: !!data,
          hasSuccess: data?.success,
          hasOffplans: !!data?.offplans
        }
      });
    }

    const externalOffplans = data.offplans;
    const results = {
      total: externalOffplans.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    console.log(`📦 Processing ${externalOffplans.length} offplans...`);

    // Process each offplan
    for (const externalOffplan of externalOffplans) {
      try {
        // ============================================
        // STEP 1: Extract English content from API
        // ============================================
        const englishTitle = externalOffplan.title || '';
        const englishLocation = externalOffplan.subtitle || externalOffplan.community || externalOffplan.city || '';
        const englishDescription = externalOffplan.description ? cleanDescription(externalOffplan.description) : '';

        console.log(`📥 Extracted English content from API:`);
        console.log(`   Title: ${englishTitle.substring(0, 50)}...`);

        // ============================================
        // STEP 2: Translate English to French (EN -> FR)
        // ============================================
        console.log(`🌐 Translating English to French (EN -> FR)...`);

        // ============================================
        // STEP 3: Translate English to Spanish (EN -> ES)
        // ============================================
        console.log(`🌐 Translating English to Spanish (EN -> ES)...`);

        // Translate all fields: EN -> FR and EN -> ES in parallel
        // Wrap each translation in try-catch to ensure we always get a result
        const translationPromises = [
          // Translate English to French
          englishTitle ? translateToFrench(englishTitle).catch(err => {
            console.error(`❌ French title translation failed:`, err.message);
            return englishTitle; // Fallback to English
          }) : Promise.resolve(''),
          englishLocation ? translateToFrench(englishLocation).catch(err => {
            console.error(`❌ French location translation failed:`, err.message);
            return englishLocation; // Fallback to English
          }) : Promise.resolve(''),
          englishDescription ? translateHtmlToFrench(englishDescription).catch(err => {
            console.error(`❌ French description translation failed:`, err.message);
            return englishDescription; // Fallback to English
          }) : Promise.resolve(''),
          // Translate English to Spanish - CRITICAL: Must always succeed
          englishTitle ? translateToSpanish(englishTitle).catch(err => {
            console.error(`❌ Spanish title translation failed:`, err.message);
            return englishTitle; // Fallback to English
          }) : Promise.resolve(''),
          englishLocation ? translateToSpanish(englishLocation).catch(err => {
            console.error(`❌ Spanish location translation failed:`, err.message);
            return englishLocation; // Fallback to English
          }) : Promise.resolve(''),
          englishDescription ? translateHtmlToSpanish(englishDescription).catch(err => {
            console.error(`❌ Spanish description translation failed:`, err.message);
            return englishDescription; // Fallback to English
          }) : Promise.resolve('')
        ];

        const [
          frenchTitle,      // EN -> FR translation
          frenchLocation,   // EN -> FR translation
          frenchDescription,// EN -> FR translation
          spanishTitle,     // EN -> ES translation
          spanishLocation,  // EN -> ES translation
          spanishDescription// EN -> ES translation
        ] = await Promise.all(translationPromises);

        // Check if offplan already exists (by title only - don't use external id)
        // We need to check this BEFORE setting final values so we can preserve existing translations
        const existingOffplan = await OffPlan.findOne({
          'title.en': externalOffplan.title
        });

        // ============================================
        // STEP 4: Validate translations and set fallbacks
        // ============================================
        // Ensure French translations are not empty - fallback to English if translation fails
        const finalFrenchTitle = (frenchTitle && frenchTitle.trim() !== '') ? frenchTitle : englishTitle;
        const finalFrenchLocation = (frenchLocation && frenchLocation.trim() !== '') ? frenchLocation : englishLocation;
        const finalFrenchDescription = (frenchDescription && frenchDescription.trim() !== '') ? frenchDescription : englishDescription;

        // Ensure Spanish translations are not empty - fallback to English if translation fails
        // BUT: If updating existing and Spanish translation failed, try to preserve existing Spanish
        let finalSpanishTitle = (spanishTitle && spanishTitle.trim() !== '' && spanishTitle !== englishTitle)
          ? spanishTitle
          : (existingOffplan?.title?.es && existingOffplan.title.es.trim() !== '' && existingOffplan.title.es !== englishTitle)
            ? existingOffplan.title.es
            : englishTitle;

        let finalSpanishLocation = (spanishLocation && spanishLocation.trim() !== '' && spanishLocation !== englishLocation)
          ? spanishLocation
          : (existingOffplan?.location?.es && existingOffplan.location.es.trim() !== '' && existingOffplan.location.es !== englishLocation)
            ? existingOffplan.location.es
            : englishLocation;

        let finalSpanishDescription = (spanishDescription && spanishDescription.trim() !== '' && spanishDescription !== englishDescription)
          ? spanishDescription
          : (existingOffplan?.description?.es && existingOffplan.description.es.trim() !== '' && existingOffplan.description.es !== englishDescription)
            ? existingOffplan.description.es
            : englishDescription;

        // Log if we're preserving existing translations
        if (existingOffplan && finalSpanishTitle === existingOffplan.title?.es && spanishTitle !== existingOffplan.title?.es) {
          console.log(`📌 Preserved existing Spanish title from database`);
        }
        if (existingOffplan && finalSpanishLocation === existingOffplan.location?.es && spanishLocation !== existingOffplan.location?.es) {
          console.log(`📌 Preserved existing Spanish location from database`);
        }

        // Log translation results
        console.log(`✅ Translation Results:`);
        console.log(`   📝 EN (Original): ${englishTitle.substring(0, 40)}...`);
        console.log(`   🇫🇷 FR (Translated from EN): ${finalFrenchTitle.substring(0, 40)}...`);
        console.log(`   🇪🇸 ES (Translated from EN): ${finalSpanishTitle.substring(0, 40)}...`);

        // Verify translations were successful
        if (!frenchTitle || frenchTitle.trim() === '' || frenchTitle === englishTitle) {
          console.warn(`⚠️  French translation may have failed, using English as fallback`);
        }
        if (!spanishTitle || spanishTitle.trim() === '' || spanishTitle === englishTitle) {
          console.warn(`⚠️  Spanish translation may have failed, using English as fallback`);
        }

        // Add a small delay to avoid rate limiting
        await delay(150);

        // ============================================
        // STEP 5: Prepare data for MongoDB storage
        // Store: EN (original from API), FR (translated from EN), ES (translated from EN)
        // ============================================
        const offplanData: any = {
          // Title: Store EN (original), FR (EN->FR translation), ES (EN->ES translation)
          title: {
            en: englishTitle,                    // Original English from API
            fr: finalFrenchTitle,                // Translated from EN to FR
            es: finalSpanishTitle,               // Translated from EN to ES
          },
          // Location: Store EN (original), FR (EN->FR translation), ES (EN->ES translation)
          location: {
            en: englishLocation,                 // Original English from API
            fr: finalFrenchLocation,             // Translated from EN to FR
            es: finalSpanishLocation,            // Translated from EN to ES
          },
          developer: externalOffplan.developer || '',
          type: externalOffplan.property_type === 'AP' ? 'Apartment' :
            externalOffplan.property_type === 'VI' ? 'Villa' :
              externalOffplan.property_type === 'TH' ? 'Townhouse' :
                externalOffplan.property_type === 'PH' ? 'Penthouse' :
                  'Apartment',
          for: externalOffplan.offering_type === 'offPlan' ? 'buy' :
            (externalOffplan.for || 'buy') as 'buy' | 'rent',
          handover: externalOffplan.handover || '',
          priceFrom: externalOffplan.starting_price ? String(externalOffplan.starting_price) : '',
          paymentPlan: externalOffplan.payment_plan || '',
          bedRange: externalOffplan.bedroom || '',
          bathRange: externalOffplan.bathroom || '',
          sizeRange: externalOffplan.area_size ? `${externalOffplan.area_size} ${externalOffplan.area_unit || 'SQFT'}` : '',
          serviceCharges: externalOffplan.service_charges ? String(externalOffplan.service_charges) : '',
          status: externalOffplan.status === 'off_plan' ? 'Available' :
            externalOffplan.status || 'Available',
          // Description: Store EN (original), FR (EN->FR translation), ES (EN->ES translation)
          description: englishDescription ? {
            en: englishDescription,               // Original English from API
            fr: finalFrenchDescription,          // Translated from EN to FR
            es: finalSpanishDescription,         // Translated from EN to ES
          } : undefined,
          amenities: externalOffplan.amenities || [],
          geoLocation: externalOffplan.geo_location ? {
            latitude: String(externalOffplan.geo_location.latitude || ''),
            longitude: String(externalOffplan.geo_location.longitude || '')
          } : undefined,
        };

        // Explicitly exclude _id and id from external API
        // MongoDB will generate its own _id automatically

        // Download and upload main image to Cloudinary
        if (externalOffplan.gallery && externalOffplan.gallery.length > 0) {
          const mainImage = externalOffplan.gallery[0];
          offplanData.image = await downloadAndUploadImage(mainImage, 'offplans/images');

          // Download and upload additional images
          if (externalOffplan.gallery.length > 1) {
            const additionalImages = externalOffplan.gallery.slice(1);
            offplanData.images = await downloadAndUploadMultipleImages(additionalImages, 'offplans/images');
          }
        } else if (externalOffplan.image) {
          offplanData.image = await downloadAndUploadImage(externalOffplan.image, 'offplans/images');
        }

        // Floor Plans Processing - Commented Out
        // if (externalOffplan.floor_plan && externalOffplan.floor_plan.floors) {
        //   const floorPlans = await Promise.all(
        //     externalOffplan.floor_plan.floors.map(async (floor: any) => {
        //       const floorImage = await downloadAndUploadImage(floor.image, 'offplans/floor-plans');
        //       return {
        //         title: floor.name || '',
        //         size: floor.area || '',
        //         status: floor.status === 'available' ? 'Available' :
        //           floor.status === 'sold_out' ? 'Sold Out' :
        //             floor.status || 'Available',
        //         image: floorImage
        //       };
        //     })
        //   );
        //   offplanData.floorPlans = floorPlans;
        // }

        // Process nearby landmarks
        if (externalOffplan.landmarks_near_you && externalOffplan.landmarks_near_you.length > 0) {
          const landmarks = await Promise.all(
            externalOffplan.landmarks_near_you.map(async (landmark: any) => {
              const landmarkImage = await downloadAndUploadImage(landmark.photo, 'offplans/landmarks');
              return {
                title: landmark.name || '',
                time: landmark.time ? `${landmark.time} min` : '',
                image: landmarkImage
              };
            })
          );
          offplanData.nearbyLandmarks = landmarks;
        }


        // ============================================
        // STEP 6: Final verification before saving to MongoDB
        // Ensure all language fields (EN, FR, ES) are populated
        // ============================================
        // Verify French fields are populated
        if (!offplanData.title.fr || offplanData.title.fr.trim() === '') {
          console.warn(`⚠️  French title is empty, using English fallback`);
          offplanData.title.fr = englishTitle;
        }
        if (!offplanData.location.fr || offplanData.location.fr.trim() === '') {
          console.warn(`⚠️  French location is empty, using English fallback`);
          offplanData.location.fr = englishLocation;
        }

        // CRITICAL: Verify Spanish fields are populated - MUST ALWAYS HAVE A VALUE
        if (!offplanData.title.es || offplanData.title.es.trim() === '') {
          console.error(`❌ CRITICAL: Spanish title is empty! Using English fallback`);
          offplanData.title.es = englishTitle;
        } else {
          console.log(`✅ Spanish title is set: ${offplanData.title.es.substring(0, 30)}...`);
        }

        if (!offplanData.location.es || offplanData.location.es.trim() === '') {
          console.error(`❌ CRITICAL: Spanish location is empty! Using English fallback`);
          offplanData.location.es = englishLocation;
        } else {
          console.log(`✅ Spanish location is set: ${offplanData.location.es.substring(0, 30)}...`);
        }

        if (offplanData.description) {
          if (!offplanData.description.es || offplanData.description.es.trim() === '') {
            console.error(`❌ CRITICAL: Spanish description is empty! Using English fallback`);
            offplanData.description.es = englishDescription;
          } else {
            console.log(`✅ Spanish description is set (${offplanData.description.es.length} chars)`);
          }
        }
        if (offplanData.description && (!offplanData.description.fr || offplanData.description.fr.trim() === '')) {
          console.warn(`⚠️  French description is empty, using English fallback`);
          offplanData.description.fr = englishDescription;
        }

        // Ensure no _id or id fields are included (MongoDB will generate its own _id)
        delete offplanData._id;
        delete offplanData.id;

        // ============================================
        // STEP 7: Save to MongoDB with all three languages
        // ============================================
        if (existingOffplan) {
          // Update existing offplan (use existing MongoDB _id)
          await OffPlan.findByIdAndUpdate(existingOffplan._id, offplanData, { new: true });
          results.updated++;
          console.log(`✅ Updated offplan in MongoDB: ${externalOffplan.title}`);
          console.log(`   ✅ Stored with 3 languages: EN (original), FR (EN->FR), ES (EN->ES)`);
          console.log(`   📝 EN Title: ${offplanData.title.en.substring(0, 30)}...`);
          console.log(`   📝 FR Title: ${offplanData.title.fr.substring(0, 30)}...`);
          console.log(`   📝 ES Title: ${offplanData.title.es.substring(0, 30)}...`);
        } else {
          // Create new offplan (MongoDB will auto-generate _id)
          await OffPlan.create(offplanData);
          results.created++;
          console.log(`✅ Created offplan in MongoDB: ${externalOffplan.title}`);
          console.log(`   ✅ Stored with 3 languages: EN (original), FR (EN->FR), ES (EN->ES)`);
          console.log(`   📝 EN Title: ${offplanData.title.en.substring(0, 30)}...`);
          console.log(`   📝 FR Title: ${offplanData.title.fr.substring(0, 30)}...`);
          console.log(`   📝 ES Title: ${offplanData.title.es.substring(0, 30)}...`);
        }
      } catch (error: any) {
        const errorMsg = `Error processing offplan ${externalOffplan.title || externalOffplan.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Offplans synced successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error syncing offplans:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing offplans from external API',
      error: error.message
    });
  }
};

// ===========================
// ADD SPANISH TRANSLATIONS TO EXISTING OFFPLANS
// ===========================
export const addSpanishTranslations = async (req: Request, res: Response) => {
  try {
    console.log('🌐 Starting to add Spanish translations to existing offplans...');

    // Find all offplans that have English but missing Spanish
    const offplans = await OffPlan.find({
      $or: [
        { 'title.es': { $exists: false } },
        { 'title.es': '' },
        { 'location.es': { $exists: false } },
        { 'location.es': '' }
      ],
      'title.en': { $exists: true, $ne: '' }
    });

    console.log(`📦 Found ${offplans.length} offplans that need Spanish translations`);

    const results = {
      total: offplans.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const offplan of offplans) {
      try {
        const englishTitle = offplan.title?.en || '';
        const englishLocation = offplan.location?.en || '';
        const englishDescription = offplan.description?.en || '';

        if (!englishTitle) {
          console.warn(`⚠️  Skipping offplan ${offplan._id}: No English title`);
          results.skipped++;
          continue;
        }

        console.log(`🌐 Translating: ${englishTitle.substring(0, 40)}...`);

        // Translate to Spanish
        const [spanishTitle, spanishLocation, spanishDescription] = await Promise.all([
          englishTitle ? translateToSpanish(englishTitle).catch(err => {
            console.error(`❌ Spanish title translation failed:`, err.message);
            return englishTitle;
          }) : Promise.resolve(''),
          englishLocation ? translateToSpanish(englishLocation).catch(err => {
            console.error(`❌ Spanish location translation failed:`, err.message);
            return englishLocation;
          }) : Promise.resolve(''),
          englishDescription ? translateHtmlToSpanish(englishDescription).catch(err => {
            console.error(`❌ Spanish description translation failed:`, err.message);
            return englishDescription;
          }) : Promise.resolve('')
        ]);

        // Ensure translations are valid
        const finalSpanishTitle = (spanishTitle && spanishTitle.trim() !== '' && spanishTitle !== englishTitle)
          ? spanishTitle
          : englishTitle;

        const finalSpanishLocation = (spanishLocation && spanishLocation.trim() !== '' && spanishLocation !== englishLocation)
          ? spanishLocation
          : englishLocation;

        const finalSpanishDescription = (spanishDescription && spanishDescription.trim() !== '' && spanishDescription !== englishDescription)
          ? spanishDescription
          : englishDescription;

        // Update the offplan with Spanish translations
        const updateData: any = {};

        if (!offplan.title?.es || offplan.title.es.trim() === '') {
          updateData['title.es'] = finalSpanishTitle;
        }
        if (!offplan.location?.es || offplan.location.es.trim() === '') {
          updateData['location.es'] = finalSpanishLocation;
        }
        if (englishDescription && (!offplan.description?.es || offplan.description.es.trim() === '')) {
          updateData['description.es'] = finalSpanishDescription;
        }

        if (Object.keys(updateData).length > 0) {
          await OffPlan.findByIdAndUpdate(offplan._id, { $set: updateData });
          results.updated++;
          console.log(`✅ Updated offplan: ${englishTitle.substring(0, 30)}...`);
          console.log(`   📝 ES Title: ${finalSpanishTitle.substring(0, 30)}...`);
        } else {
          results.skipped++;
        }

        // Add delay to avoid rate limiting
        await delay(150);

      } catch (error: any) {
        const errorMsg = `Error processing offplan ${offplan._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    console.log(`✅ Completed adding Spanish translations`);
    console.log(`   Total: ${results.total}, Updated: ${results.updated}, Skipped: ${results.skipped}`);

    res.status(200).json({
      success: true,
      message: 'Spanish translations added successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error adding Spanish translations:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding Spanish translations to offplans',
      error: error.message
    });
  }
};

// ===========================
// REPLACE AMENITIES WITH PROPER NAMES
// ===========================
export const replaceAmenities = async (req: Request, res: Response) => {
  try {
    console.log('🔄 Replacing amenities with proper names...');

    // List of proper amenity names
    const properAmenities = [
      "Air Conditioning",
      "Covered Parking",
      "Shared Pool",
      "Security",
      "Swimming Pool",
      "Retail Center",
      "Children's Play Area",
      "Shared Gym",
      "Gym",
      "Balcony",
      "Maid's Room",
      "Storage",
      "Featured"
    ];

    // Get all offplans
    const offplans = await OffPlan.find({});
    console.log(`📦 Found ${offplans.length} offplans to update`);

    const results = {
      total: offplans.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const offplan of offplans) {
      try {
        // Randomly select 7-8 amenities (between 7 and 8 inclusive)
        const numberOfAmenities = Math.floor(Math.random() * 2) + 7; // 7 or 8
        const shuffled = [...properAmenities].sort(() => Math.random() - 0.5);
        const selectedAmenities = shuffled.slice(0, numberOfAmenities);

        // Update the offplan with new amenities
        await OffPlan.findByIdAndUpdate(
          offplan._id,
          { $set: { amenities: selectedAmenities } }
        );

        results.updated++;
        console.log(`✅ Updated offplan ${offplan._id}: Added ${selectedAmenities.length} amenities`);
        console.log(`   Amenities: ${selectedAmenities.join(', ')}`);

      } catch (error: any) {
        const errorMsg = `Error updating offplan ${offplan._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    console.log(`✅ Completed replacing amenities`);
    console.log(`   Total: ${results.total}, Updated: ${results.updated}, Skipped: ${results.skipped}`);

    res.status(200).json({
      success: true,
      message: 'Amenities replaced successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error replacing amenities:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing amenities',
      error: error.message
    });
  }
};

// ===========================
// CLEAR AMENITIES FROM ALL OFFPLANS
// ===========================
export const clearAllAmenities = async (req: Request, res: Response) => {
  try {
    console.log('🧹 Clearing amenities from all offplans...');

    // Update all offplans to set amenities to empty array
    const result = await OffPlan.updateMany(
      {},
      { $set: { amenities: [] } }
    );

    console.log(`✅ Cleared amenities from ${result.modifiedCount} offplans`);

    res.status(200).json({
      success: true,
      message: `Successfully cleared amenities from ${result.modifiedCount} offplans`,
      data: {
        totalOffplans: result.matchedCount,
        updated: result.modifiedCount
      }
    });
  } catch (error: any) {
    console.error('❌ Error clearing amenities:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing amenities from offplans',
      error: error.message
    });
  }
};

// ===========================
// ADD FRENCH AND SPANISH TRANSLATIONS FOR TITLES
// ===========================
/**
 * POST /api/offplans/translate-titles
 * Add French and Spanish translations for offplan titles that only have English
 */
export const translateOffPlanTitles = async (req: Request, res: Response) => {
  try {
    console.log('🌐 Starting to add French and Spanish translations for offplan titles...');

    // Find all offplans that have English title but are missing French or Spanish
    const offplans = await OffPlan.find({
      'title.en': { $exists: true, $ne: '' },
      $or: [
        { 'title.fr': { $exists: false } },
        { 'title.fr': '' },
        { 'title.es': { $exists: false } },
        { 'title.es': '' }
      ]
    });

    console.log(`📦 Found ${offplans.length} offplans that need translations`);

    const results = {
      total: offplans.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      translations: {
        fr: 0,
        es: 0
      }
    };

    for (const offplan of offplans) {
      try {
        const englishTitle = offplan.title?.en || '';

        if (!englishTitle || englishTitle.trim() === '') {
          console.warn(`⚠️  Skipping offplan ${offplan._id}: No English title`);
          results.skipped++;
          continue;
        }

        console.log(`🌐 Translating title: ${englishTitle.substring(0, 50)}...`);

        // Check what translations are needed
        const needsFrench = !offplan.title?.fr || offplan.title.fr.trim() === '';
        const needsSpanish = !offplan.title?.es || offplan.title.es.trim() === '';

        const updateData: any = {};

        // Translate to French if needed
        if (needsFrench) {
          try {
            const frenchTitle = await translateToFrench(englishTitle);
            
            if (frenchTitle && frenchTitle.trim() !== '' && frenchTitle !== englishTitle) {
              updateData['title.fr'] = frenchTitle;
              results.translations.fr++;
              console.log(`   ✅ FR: ${frenchTitle.substring(0, 40)}...`);
            } else {
              console.warn(`   ⚠️  French translation failed or returned same text for: ${englishTitle.substring(0, 30)}...`);
            }
          } catch (error: any) {
            console.error(`   ❌ French translation error:`, error.message);
          }
        }

        // Add delay between translations to avoid rate limiting
        if (needsFrench && needsSpanish) {
          await delay(100);
        }

        // Translate to Spanish if needed
        if (needsSpanish) {
          try {
            const spanishTitle = await translateToSpanish(englishTitle);
            
            if (spanishTitle && spanishTitle.trim() !== '' && spanishTitle !== englishTitle) {
              updateData['title.es'] = spanishTitle;
              results.translations.es++;
              console.log(`   ✅ ES: ${spanishTitle.substring(0, 40)}...`);
            } else {
              console.warn(`   ⚠️  Spanish translation failed or returned same text for: ${englishTitle.substring(0, 30)}...`);
            }
          } catch (error: any) {
            console.error(`   ❌ Spanish translation error:`, error.message);
          }
        }

        // Update the offplan if we have translations
        if (Object.keys(updateData).length > 0) {
          await OffPlan.findByIdAndUpdate(offplan._id, { $set: updateData });
          results.updated++;
          console.log(`✅ Updated offplan ${offplan._id}: ${englishTitle.substring(0, 30)}...`);
        } else {
          results.skipped++;
          console.warn(`⚠️  No translations added for offplan ${offplan._id}`);
        }

        // Add delay to avoid rate limiting (longer delay to be safe)
        await delay(200);

      } catch (error: any) {
        const errorMsg = `Error processing offplan ${offplan._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    console.log(`✅ Completed adding translations`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Updated: ${results.updated}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   French translations: ${results.translations.fr}`);
    console.log(`   Spanish translations: ${results.translations.es}`);
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length}`);
    }

    res.status(200).json({
      success: true,
      message: 'French and Spanish translations added successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error adding translations:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding French and Spanish translations to offplans',
      error: error.message
    });
  }
};

/**
 * POST /api/offplans/translate-all
 * Translate all multilingual fields (title, location, description) from English to French and Spanish
 * for offplans that are missing translations
 */
export const translateAllOffPlanFields = async (req: Request, res: Response) => {
  try {
    console.log('🌐 Starting comprehensive translation for all offplan fields...');

    // Find all offplans that have English content but are missing French or Spanish translations
    const offplans = await OffPlan.find({
      $or: [
        // Title missing translations
        {
          'title.en': { $exists: true, $ne: '' },
          $or: [
            { 'title.fr': { $exists: false } },
            { 'title.fr': '' },
            { 'title.es': { $exists: false } },
            { 'title.es': '' }
          ]
        },
        // Location missing translations
        {
          'location.en': { $exists: true, $ne: '' },
          $or: [
            { 'location.fr': { $exists: false } },
            { 'location.fr': '' },
            { 'location.es': { $exists: false } },
            { 'location.es': '' }
          ]
        },
        // Description missing translations
        {
          'description.en': { $exists: true, $ne: '' },
          $or: [
            { 'description.fr': { $exists: false } },
            { 'description.fr': '' },
            { 'description.es': { $exists: false } },
            { 'description.es': '' }
          ]
        }
      ]
    });

    console.log(`📦 Found ${offplans.length} offplans that need translations`);

    const results = {
      total: offplans.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      translations: {
        title: { fr: 0, es: 0 },
        location: { fr: 0, es: 0 },
        description: { fr: 0, es: 0 }
      }
    };

    for (let i = 0; i < offplans.length; i++) {
      const offplan = offplans[i];
      try {
        console.log(`\n[${i + 1}/${offplans.length}] Processing offplan ${offplan._id}...`);

        const updateData: any = {};
        let hasUpdates = false;

        // Translate Title
        const englishTitle = offplan.title?.en || '';
        if (englishTitle && englishTitle.trim() !== '') {
          const needsFrenchTitle = !offplan.title?.fr || offplan.title.fr.trim() === '';
          const needsSpanishTitle = !offplan.title?.es || offplan.title.es.trim() === '';

          if (needsFrenchTitle) {
            try {
              console.log(`   Translating title to French: ${englishTitle.substring(0, 50)}...`);
              const frenchTitle = await translateToFrench(englishTitle);
              if (frenchTitle && frenchTitle.trim() !== '' && frenchTitle !== englishTitle) {
                updateData['title.fr'] = frenchTitle;
                results.translations.title.fr++;
                hasUpdates = true;
                console.log(`   ✅ Title FR: ${frenchTitle.substring(0, 40)}...`);
              }
              await delay(100); // Delay to avoid rate limiting
            } catch (error: any) {
              console.error(`   ❌ French title translation error:`, error.message);
            }
          }

          if (needsSpanishTitle) {
            try {
              console.log(`   Translating title to Spanish: ${englishTitle.substring(0, 50)}...`);
              const spanishTitle = await translateToSpanish(englishTitle);
              if (spanishTitle && spanishTitle.trim() !== '' && spanishTitle !== englishTitle) {
                updateData['title.es'] = spanishTitle;
                results.translations.title.es++;
                hasUpdates = true;
                console.log(`   ✅ Title ES: ${spanishTitle.substring(0, 40)}...`);
              }
              await delay(100);
            } catch (error: any) {
              console.error(`   ❌ Spanish title translation error:`, error.message);
            }
          }
        }

        // Translate Location
        const englishLocation = offplan.location?.en || '';
        if (englishLocation && englishLocation.trim() !== '') {
          const needsFrenchLocation = !offplan.location?.fr || offplan.location.fr.trim() === '';
          const needsSpanishLocation = !offplan.location?.es || offplan.location.es.trim() === '';

          if (needsFrenchLocation) {
            try {
              console.log(`   Translating location to French: ${englishLocation.substring(0, 50)}...`);
              const frenchLocation = await translateToFrench(englishLocation);
              if (frenchLocation && frenchLocation.trim() !== '' && frenchLocation !== englishLocation) {
                updateData['location.fr'] = frenchLocation;
                results.translations.location.fr++;
                hasUpdates = true;
                console.log(`   ✅ Location FR: ${frenchLocation.substring(0, 40)}...`);
              }
              await delay(100);
            } catch (error: any) {
              console.error(`   ❌ French location translation error:`, error.message);
            }
          }

          if (needsSpanishLocation) {
            try {
              console.log(`   Translating location to Spanish: ${englishLocation.substring(0, 50)}...`);
              const spanishLocation = await translateToSpanish(englishLocation);
              if (spanishLocation && spanishLocation.trim() !== '' && spanishLocation !== englishLocation) {
                updateData['location.es'] = spanishLocation;
                results.translations.location.es++;
                hasUpdates = true;
                console.log(`   ✅ Location ES: ${spanishLocation.substring(0, 40)}...`);
              }
              await delay(100);
            } catch (error: any) {
              console.error(`   ❌ Spanish location translation error:`, error.message);
            }
          }
        }

        // Translate Description (HTML content)
        const englishDescription = offplan.description?.en || '';
        if (englishDescription && englishDescription.trim() !== '') {
          const needsFrenchDescription = !offplan.description?.fr || offplan.description.fr.trim() === '';
          const needsSpanishDescription = !offplan.description?.es || offplan.description.es.trim() === '';

          if (needsFrenchDescription) {
            try {
              console.log(`   Translating description to French (HTML)...`);
              const frenchDescription = await translateHtmlToFrench(englishDescription);
              if (frenchDescription && frenchDescription.trim() !== '' && frenchDescription !== englishDescription) {
                updateData['description.fr'] = frenchDescription;
                results.translations.description.fr++;
                hasUpdates = true;
                console.log(`   ✅ Description FR: ${frenchDescription.substring(0, 40)}...`);
              }
              await delay(200); // Longer delay for HTML content
            } catch (error: any) {
              console.error(`   ❌ French description translation error:`, error.message);
            }
          }

          if (needsSpanishDescription) {
            try {
              console.log(`   Translating description to Spanish (HTML)...`);
              const spanishDescription = await translateHtmlToSpanish(englishDescription);
              if (spanishDescription && spanishDescription.trim() !== '' && spanishDescription !== englishDescription) {
                updateData['description.es'] = spanishDescription;
                results.translations.description.es++;
                hasUpdates = true;
                console.log(`   ✅ Description ES: ${spanishDescription.substring(0, 40)}...`);
              }
              await delay(200);
            } catch (error: any) {
              console.error(`   ❌ Spanish description translation error:`, error.message);
            }
          }
        }

        // Update the offplan if we have translations
        if (hasUpdates && Object.keys(updateData).length > 0) {
          await OffPlan.findByIdAndUpdate(offplan._id, { $set: updateData });
          results.updated++;
          console.log(`✅ Updated offplan ${offplan._id}`);
        } else {
          results.skipped++;
          console.log(`⚠️  No translations needed or added for offplan ${offplan._id}`);
        }

        // Add delay between offplans to avoid rate limiting
        if (i < offplans.length - 1) {
          await delay(300);
        }

      } catch (error: any) {
        const errorMsg = `Error processing offplan ${offplan._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    console.log(`\n✅ Completed comprehensive translation`);
    console.log(`   Total offplans processed: ${results.total}`);
    console.log(`   Updated: ${results.updated}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Title translations - FR: ${results.translations.title.fr}, ES: ${results.translations.title.es}`);
    console.log(`   Location translations - FR: ${results.translations.location.fr}, ES: ${results.translations.location.es}`);
    console.log(`   Description translations - FR: ${results.translations.description.fr}, ES: ${results.translations.description.es}`);
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length}`);
      console.log(`   First few errors:`, results.errors.slice(0, 5));
    }

    res.status(200).json({
      success: true,
      message: 'All translations added successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error adding translations:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding translations to offplans',
      error: error.message
    });
  }
};

// ===========================
// FIX EXISTING BROCHURE URLs (Make them public)
// ===========================
/**
 * POST /api/offplans/fix-brochures
 * Fix all existing brochure URLs by making them public in Cloudinary
 */
export const fixBrochureUrls = async (req: Request, res: Response) => {
  try {
    console.log('🔧 Starting to fix brochure URLs...');

    // Find all offplans that have a brochure URL
    const offplans = await OffPlan.find({
      brochure: { $exists: true, $nin: ['', null] }
    });

    console.log(`📦 Found ${offplans.length} offplans with brochures`);

    const results = {
      total: offplans.length,
      fixed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const offplan of offplans) {
      try {
        if (!offplan.brochure || typeof offplan.brochure !== 'string') {
          results.skipped++;
          continue;
        }

        const brochureUrl = offplan.brochure.trim();
        
        // Check if it's a Cloudinary URL
        if (!brochureUrl.includes('cloudinary.com')) {
          console.log(`⚠️  Skipping non-Cloudinary URL: ${offplan._id}`);
          results.skipped++;
          continue;
        }

        console.log(`🔧 Fixing brochure for offplan ${offplan._id}: ${brochureUrl.substring(0, 60)}...`);

        // Extract public_id and make it public
        const publicId = extractPublicIdFromUrl(brochureUrl);
        if (!publicId) {
          console.warn(`⚠️  Could not extract public_id from URL: ${brochureUrl}`);
          results.skipped++;
          continue;
        }

        // Make the resource public
        const newUrl = await fixCloudinaryUrl(brochureUrl, 'raw');
        
        // Update the offplan with the new URL (in case it changed)
        if (newUrl !== brochureUrl) {
          await OffPlan.findByIdAndUpdate(offplan._id, { brochure: newUrl });
          console.log(`✅ Updated brochure URL for offplan ${offplan._id}`);
        } else {
          console.log(`✅ Made brochure public for offplan ${offplan._id}`);
        }

        results.fixed++;

        // Add small delay to avoid rate limiting
        await delay(100);

      } catch (error: any) {
        const errorMsg = `Error fixing brochure for offplan ${offplan._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        results.skipped++;
      }
    }

    console.log(`✅ Completed fixing brochures`);
    console.log(`   Total: ${results.total}, Fixed: ${results.fixed}, Skipped: ${results.skipped}`);

    res.status(200).json({
      success: true,
      message: 'Brochure URLs fixed successfully',
      data: results
    });
  } catch (error: any) {
    console.error('❌ Error fixing brochure URLs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing brochure URLs',
      error: error.message
    });
  }
};