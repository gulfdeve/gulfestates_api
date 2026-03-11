import { Request, Response } from "express";
import Property from "../models/property.model.js";
import { createNotification } from "./notification.controller.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import escapeStringRegexp from "escape-string-regexp";

const uploadImage = async (filePath: string) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "properties/images",
  });
  fs.unlinkSync(filePath);
  return result.secure_url;
};

const uploadMultipleImages = async (files: Express.Multer.File[]) => {
  const uploadPromises = files.map(file => uploadImage(file.path));
  return Promise.all(uploadPromises);
};

// Helper function to upload PDF files
const uploadPDF = async (filePath: string) => {
  try {
    console.log("📤 Uploading PDF to Cloudinary from path:", filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "properties/brochures",
      resource_type: "raw", // PDF files should be uploaded as raw files
      use_filename: true,
      unique_filename: true,
      access_mode: "public", // Ensure the file is publicly accessible
      type: "upload", // Explicitly set upload type
    });

    // For raw files, use secure_url directly but ensure it's properly formatted
    // Cloudinary's secure_url for raw files should already be correct
    let pdfUrl = result.secure_url;

    // Ensure the URL uses HTTPS and has the correct path structure for raw files
    // If secure_url doesn't contain '/raw/upload/', regenerate it using cloudinary.url()
    if (!pdfUrl.includes('/raw/upload/')) {
      pdfUrl = cloudinary.url(result.public_id, {
        resource_type: 'raw',
        secure: true
      });
    }

    console.log("✅ PDF uploaded successfully to Cloudinary:", pdfUrl);
    console.log("📄 Public ID:", result.public_id);

    // Delete local file after successful upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑️ Local file deleted:", filePath);
    }

    return pdfUrl;
  } catch (error) {
    console.error("❌ Error uploading PDF to Cloudinary:", error);
    // Delete local file even on error
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error("Error deleting local file:", unlinkError);
      }
    }
    throw error;
  }
};

// Helper function to get localized field
const getLocalizedField = (field: any, locale: string = 'en') => {
  if (!field) return '';

  if (typeof field === 'string') return field;

  if (typeof field === 'object') {
    if (field[locale]) {
      return field[locale];
    }
    if (field.en) {
      return field.en;
    }
  }

  return '';
};

// Helper function to localize property
const localizeProperty = (property: any, locale: string = 'en') => {
  if (!property) return property;

  const propertyObj = property.toObject ? property.toObject() : property;

  return {
    ...propertyObj,
    // Return simple strings for frontend display
    title: getLocalizedField(propertyObj.title, locale),
    description: getLocalizedField(propertyObj.description, locale),
    location: getLocalizedField(propertyObj.location, locale),
  };
};

// Helper function to localize multiple properties
const localizeProperties = (properties: any[], locale: string = 'en') => {
  return properties.map(property => localizeProperty(property, locale));
};

// ===========================
// GET ALL PROPERTIES WITH PAGINATION & FILTERS
// ===========================
export const getAllProperties = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 9,
      locale = 'en',
      for: propertyFor,
      type,
      location,
      title,
      minPrice,
      maxPrice,
      minBeds,
      minBaths,
      beds,
      baths,
      bedrooms
    } = req.query;

    // Fix: Properly type query parameters
    const filter: Record<string, any> = {};

    // Language-specific filtering: only show items with content in the requested language
    // FR/ES properties must NOT appear on EN, and vice versa - each locale shows only its own
    const localeString = typeof locale === 'string' ? locale : 'en';
    if (localeString === 'en') {
      // EN: only properties with non-empty title.en (exclude FR-only, ES-only)
      filter["title.en"] = { $exists: true, $type: "string", $regex: /\S/ };
    } else if (localeString === 'fr') {
      // FR: only properties with non-empty title.fr (exclude EN-only, ES-only)
      filter["title.fr"] = { $exists: true, $type: "string", $regex: /\S/ };
    } else if (localeString === 'es') {
      // ES: only properties with non-empty title.es (exclude EN-only, FR-only)
      filter["title.es"] = { $exists: true, $type: "string", $regex: /\S/ };
    }

    if (propertyFor && typeof propertyFor === 'string' && ['buy', 'rent'].includes(propertyFor)) {
      filter.for = propertyFor;
    }
    if (type && typeof type === 'string') filter.type = type;

    // Search in all language fields for location and title
    if (location && typeof location === 'string') {
      const sanitizedLocation = escapeStringRegexp(location);
      filter.$or = [
        { "location.en": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.fr": { $regex: sanitizedLocation, $options: 'i' } },
        { "location.es": { $regex: sanitizedLocation, $options: 'i' } }
      ];
    }

    if (title && typeof title === 'string') {
      const sanitizedTitle = escapeStringRegexp(title);
      filter.$or = [
        { "title.en": { $regex: sanitizedTitle, $options: 'i' } },
        { "title.fr": { $regex: sanitizedTitle, $options: 'i' } },
        { "title.es": { $regex: sanitizedTitle, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Exact match for bedrooms: property.model has beds (Number). Dropdown sends single value = exact count.
    const bedsParam = minBeds ?? beds ?? bedrooms;
    const bedsNum = bedsParam !== undefined && bedsParam !== '' && String(bedsParam).trim() !== '' ? Number(bedsParam) : NaN;
    if (!isNaN(bedsNum) && bedsNum >= 0) filter.beds = bedsNum;

    // Exact match for bathrooms: property.model has baths (Number).
    const bathsParam = minBaths ?? baths;
    const bathsNum = bathsParam !== undefined && bathsParam !== '' && String(bathsParam).trim() !== '' ? Number(bathsParam) : NaN;
    if (!isNaN(bathsNum) && bathsNum >= 0) filter.baths = bathsNum;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // For list views: exclude description (large HTML) - fetch only when opening detail
    const excludeContent = req.query.excludeContent === 'true';
    const listProjection = excludeContent ? '-description' : '';

    const propQuery = Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    const [properties, total] = await Promise.all([
      listProjection ? propQuery.select(listProjection) : propQuery,
      Property.countDocuments(filter)
    ]);

    console.log("📸 Properties found:", properties.length);

    // Localize the properties based on locale (localeString already declared above)
    const localizedProperties = localizeProperties(properties, localeString);

    res.status(200).json({
      success: true,
      data: {
        items: localizedProperties,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error: any) {
    console.error("❌ Error fetching properties:", error);
    res.status(500).json({ success: false, message: "Server error fetching properties" });
  }
};

// ===========================
// GET SINGLE PROPERTY
// ===========================
export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { locale = 'en' } = req.query;

    // Fix: Properly type the locale parameter
    const localeString = typeof locale === 'string' ? locale : 'en';

    let property;

    // Check if id is a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isValidObjectId) {
      // Search by MongoDB _id
      property = await Property.findById(id);
    } else {
      // Search by slug (try all languages: en, es, fr)
      property = await Property.findOne({
        $or: [
          { 'slug.en': id },
          { 'slug.es': id },
          { 'slug.fr': id }
        ]
      });
    }

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Localize the property based on locale
    const propertyObj = property.toObject ? property.toObject() : property;

    const responseData = {
      ...propertyObj,
      // Simple string for basic display
      title: getLocalizedField(propertyObj.title, localeString),
      description: getLocalizedField(propertyObj.description, localeString),
      location: getLocalizedField(propertyObj.location, localeString),
      // Include raw multilingual objects for edit form (dashboard needs en, fr, es)
      titleRaw: propertyObj.title,
      descriptionRaw: propertyObj.description,
      locationRaw: propertyObj.location,
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (error: any) {
    console.error("❌ Error fetching property by ID or slug:", error);
    res.status(500).json({ success: false, message: "Server error fetching property" });
  }
};

// ===========================
// CREATE PROPERTY - REMOVED LOCATION IMAGE
// ===========================
export const createProperty = async (req: Request, res: Response) => {
  try {
    const {
      title,
      price,
      location,
      type,
      category,
      beds,
      baths,
      size,
      for: propertyFor,
      description,
      amenities,
      nearbyLandmarks,
      agent,
      buildingInfo,
      seo,
      images,
      image,
      projectStatus,
      rentDuration,
      geoLocation
    } = req.body;

    let imageUrl = image || "";
    let additionalImages: string[] = [];

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
    
    let brochureUrl = "";
    let qrImageUrl = "";
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
        imageUrl = await uploadImage(mainImageFile.path);
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

        additionalImages = await uploadMultipleImages(files.images);
        console.log("📸 Additional images uploaded:", additionalImages.length);
      }

      // Handle brochure PDF upload for CREATE
      if (files.brochure && files.brochure[0]) {
        try {
          console.log("📤 Processing brochure PDF file upload (CREATE):", files.brochure[0].filename, "Size:", files.brochure[0].size, "bytes");
          brochureUrl = await uploadPDF(files.brochure[0].path);
          console.log("✅ Property Brochure uploaded to Cloudinary (CREATE):", brochureUrl);
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
        qrImageUrl = await uploadImage(qrImageFile.path);
        console.log("📸 Property QR image uploaded:", qrImageUrl);
        req.body.qrImage = qrImageUrl;
      }
    }
    // Process images array first (needed for fallback)
    let finalImages: string[] = [];

    if (images) {
      try {
        let parsedImages: any = images;

        // If it's a string, try to parse as JSON
        if (typeof images === 'string') {
          // Check if it's a JSON array string
          if (images.trim().startsWith('[') || images.trim().startsWith('{')) {
            parsedImages = JSON.parse(images);
          } else {
            // It's a single URL string, convert to array
            parsedImages = [images];
          }
        }

        // Handle array
        if (Array.isArray(parsedImages)) {
          finalImages = parsedImages.filter((img: any) => img && typeof img === 'string');
        } else if (typeof parsedImages === 'string') {
          // Single string URL
          finalImages = [parsedImages];
        }
      } catch (error) {
        console.log("⚠️ Could not parse images as JSON, treating as single URL:", images);
        // If parsing fails, treat as single URL string
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

    // If no additional images, use main image as the only image
    if (finalImages.length === 0) {
      finalImages = [imageUrl];
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

    // Validate 'for' field
    if (propertyFor && !['buy', 'rent'].includes(propertyFor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 'for' field. Must be 'buy' or 'rent'"
      });
    }

    // Parse and clean description
    let parsedDescription = parseField(description) || { en: "", fr: "", es: "" };
    // Clean empty strings - set to undefined if empty so they're not saved
    if (parsedDescription.en && parsedDescription.en.trim() === "") {
      parsedDescription.en = undefined;
    }
    if (parsedDescription.fr && parsedDescription.fr.trim() === "") {
      parsedDescription.fr = undefined;
    }
    if (parsedDescription.es && parsedDescription.es.trim() === "") {
      parsedDescription.es = undefined;
    }

    // Parse and clean amenities - filter out boolean values and keep only strings
    let parsedAmenities = parseField(amenities) || [];
    if (Array.isArray(parsedAmenities)) {
      parsedAmenities = parsedAmenities
        .filter((item: any) => typeof item === 'string' && item.trim() !== '')
        .map((item: any) => typeof item === 'string' ? item.trim() : item);
    }

    // For CREATE: Only use uploaded brochure file (uploaded to Cloudinary)
    // Don't accept brochure URL from body in create mode - only file uploads
    const finalBrochure = brochureUrl || "";

    // Get QR image URL from body if not uploaded, or use uploaded one
    const qrImageFromBody = req.body.qrImage;
    const finalQrImageUrl = qrImageUrl || qrImageFromBody || "";

    // Get DLD Permit Number from body
    const dldPermitNumber = req.body.dldPermitNumber || "";

    // Parse geoLocation if provided
    let parsedGeoLocation = undefined;
    if (geoLocation) {
      parsedGeoLocation = parseField(geoLocation);
    }

    // Parse SEO if provided
    let parsedSeo = undefined;
    if (seo) {
      parsedSeo = parseField(seo);
      // Normalize schema: if schema is a string, convert to { en: string }
      if (parsedSeo?.schema && typeof parsedSeo.schema === 'string') {
        parsedSeo = {
          ...parsedSeo,
          schema: { en: parsedSeo.schema }
        };
      }
    }

    // Size: support number or range string (e.g. "600 - 600")
    const parseSize = (val: any) => {
      if (val == null || val === "") return 0;
      const str = String(val).trim();
      if (str.includes(" - ")) return str;  // Range format
      const num = Number(str);
      return isNaN(num) ? str : num;  // Keep string if not a valid number
    };

    const propertyData: any = {
      title: parseField(title),
      price: Number(price),
      location: parseField(location),
      type,
      beds: Number(beds),
      baths: Number(baths),
      size: parseSize(size),
      image: imageUrl,
      images: finalImages,
      for: propertyFor,
      description: parsedDescription,
      amenities: parsedAmenities,
      nearbyLandmarks: parseField(nearbyLandmarks) || [],
      agent: parseField(agent),
      buildingInfo: parseField(buildingInfo),
      ...(parsedSeo && { seo: parsedSeo }),
      ...(finalBrochure && { brochure: finalBrochure }),
      ...(finalQrImageUrl && { qrImage: finalQrImageUrl }),
      ...(dldPermitNumber && { dldPermitNumber }),
      ...(projectStatus && { projectStatus }),
      ...(propertyFor === 'rent' && rentDuration ? { rentDuration } : {}),
      ...(parsedGeoLocation && { geoLocation: parsedGeoLocation })
    };

    // Add category if provided
    if (category && ["Off Plan", "Ready"].includes(category)) {
      propertyData.category = category;
    }

    const property = await Property.create(propertyData);

    // Create notification
    const propertyTitle = typeof property.title === 'object' ? property.title.en || 'New Property' : property.title || 'New Property';
    await createNotification(
      "property",
      "created",
      "New Property Added",
      `A new property "${propertyTitle}" has been added.`,
      String(property._id)
    );

    res.status(201).json({ success: true, data: property });
  } catch (error: any) {
    console.error("❌ Error creating property:", error);
    res.status(500).json({ success: false, message: "Server error creating property" });
  }
};

// ===========================
// UPDATE PROPERTY - REMOVED LOCATION IMAGE
// ===========================
export const updateProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid property ID format" });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    let updateData: any = { ...req.body };

    // Parse JSON fields helper
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
        const imageUrl = await uploadImage(mainImageFile.path);
        updateData.image = imageUrl;
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

        const additionalImages = await uploadMultipleImages(files.images);
        // If images are already in updateData, merge them; otherwise use existing property images
        const existingImages = Array.isArray(updateData.images)
          ? updateData.images
          : (property.images || []);
        updateData.images = [...existingImages, ...additionalImages];
      }

      // Handle brochure PDF upload - File upload takes highest priority
      if (files.brochure && files.brochure[0]) {
        try {
          console.log("📤 Processing brochure PDF file upload:", files.brochure[0].filename, "Size:", files.brochure[0].size, "bytes");
          const brochureUrl = await uploadPDF(files.brochure[0].path);
          updateData.brochure = brochureUrl;
          console.log("✅ Property Brochure uploaded to Cloudinary and URL saved:", brochureUrl);
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
          console.log("📄 Property Brochure URL from body (no file upload, using existing URL):", updateData.brochure || "(empty - clearing brochure)");
        } else if (property.brochure) {
          // Keep existing brochure if no new one provided and no URL in body
          updateData.brochure = property.brochure;
          console.log("📄 Keeping existing Property brochure (no changes):", updateData.brochure);
        }
      }

      // Handle QR image upload (max 1MB)
      if (files.qrImage && files.qrImage[0]) {
        const qrImageFile = files.qrImage[0];
        const MAX_QR_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
        if (qrImageFile.size > MAX_QR_IMAGE_SIZE) {
          return res.status(400).json({
            success: false,
            message: `QR image size exceeds 1MB limit. File size: ${(qrImageFile.size / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        updateData.qrImage = await uploadImage(qrImageFile.path);
        console.log("📸 Property QR image uploaded:", updateData.qrImage);
      } else if (req.body.qrImage && typeof req.body.qrImage === 'string' && req.body.qrImage.trim() !== '') {
        // Keep existing QR image URL if no new file uploaded
        updateData.qrImage = req.body.qrImage.trim();
        console.log("📸 Property QR image URL from body (no file upload):", updateData.qrImage);
      } else if (property.qrImage) {
        // Keep existing QR image if no new one provided
        updateData.qrImage = property.qrImage;
        console.log("📸 Keeping existing Property QR image:", updateData.qrImage);
      }

      // Fallback: If main image is missing but additional images exist, use first as main
      if (!updateData.image && updateData.images && Array.isArray(updateData.images) && updateData.images.length > 0) {
        updateData.image = updateData.images[0];
        updateData.images = updateData.images.slice(1);
        console.log("📸 Using first additional image as main image fallback in update:", updateData.image);
      }
    }

    // Fallback: If still no main image, check existing property image
    if (!updateData.image) {
      if (property.image) {
        updateData.image = property.image;
        console.log("📸 Keeping existing property image:", updateData.image);
      } else if (updateData.images && Array.isArray(updateData.images) && updateData.images.length > 0) {
        updateData.image = updateData.images[0];
        updateData.images = updateData.images.slice(1);
        console.log("📸 Using first additional image as main image fallback:", updateData.image);
      } else if (property.images && Array.isArray(property.images) && property.images.length > 0) {
        updateData.image = property.images[0];
        console.log("📸 Using first existing image as main image fallback:", updateData.image);
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

    // Handle geoLocation
    if (req.body.geoLocation !== undefined) {
      const parsedGeoLocation = parseField(req.body.geoLocation);
      if (parsedGeoLocation && (parsedGeoLocation.latitude || parsedGeoLocation.longitude)) {
        updateData.geoLocation = parsedGeoLocation;
      }
    }

    // Parse specific fields that might be JSON strings
    if (updateData.title) updateData.title = parseField(updateData.title);
    if (updateData.location) updateData.location = parseField(updateData.location);
    if (updateData.description) updateData.description = parseField(updateData.description);

    // Handle images array - ensure it's always an array
    if (updateData.images !== undefined) {
      if (typeof updateData.images === 'string') {
        updateData.images = parseField(updateData.images);
      }
      // Ensure it's an array
      if (!Array.isArray(updateData.images)) {
        updateData.images = updateData.images ? [updateData.images] : [];
      }
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
    let finalImage = updateData.image || property.image;

    // Fallback: If still no image, try to get from additional images
    if (!finalImage || finalImage.trim() === "") {
      if (updateData.images && Array.isArray(updateData.images) && updateData.images.length > 0) {
        finalImage = updateData.images[0];
        updateData.image = finalImage;
        updateData.images = updateData.images.slice(1);
        console.log("📸 Using first additional image as main image fallback in final validation:", finalImage);
      } else if (property.images && Array.isArray(property.images) && property.images.length > 0) {
        finalImage = property.images[0];
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

    // Ensure finalImage is set in updateData
    updateData.image = finalImage;
    // Ensure updateData.image is set to the final image
    if (!updateData.image) {
      updateData.image = finalImage;
    }

    if (updateData.amenities && typeof updateData.amenities === 'string') {
      updateData.amenities = parseField(updateData.amenities);
    }
    // Filter out false values from amenities array
    if (Array.isArray(updateData.amenities)) {
      updateData.amenities = updateData.amenities.filter((item: any) => item !== false && item !== null && item !== "");
    }

    if (updateData.nearbyLandmarks && typeof updateData.nearbyLandmarks === 'string') {
      updateData.nearbyLandmarks = parseField(updateData.nearbyLandmarks);
    }

    // Handle agent - parse if string, clean empty values
    if (updateData.agent) {
      if (typeof updateData.agent === 'string') {
        updateData.agent = parseField(updateData.agent);
      }

      // Clean empty string values from agent object
      if (typeof updateData.agent === 'object' && updateData.agent !== null) {
        Object.keys(updateData.agent).forEach(key => {
          if (updateData.agent[key] === '' || updateData.agent[key] === null) {
            delete updateData.agent[key];
          }
        });
        // If only name is provided and it's empty, remove agent
        if (!updateData.agent.name || updateData.agent.name.trim() === '') {
          delete updateData.agent;
        }
      }
    }

    if (updateData.buildingInfo && typeof updateData.buildingInfo === 'string') {
      updateData.buildingInfo = parseField(updateData.buildingInfo);
    }
    if (updateData.seo && typeof updateData.seo === 'string') {
      updateData.seo = parseField(updateData.seo);
      // Normalize schema: if schema is a string, convert to { en: string }
      if (updateData.seo?.schema && typeof updateData.seo.schema === 'string') {
        updateData.seo = {
          ...updateData.seo,
          schema: { en: updateData.seo.schema }
        };
      }
    }

    // Parse numeric fields (size supports range string e.g. "600 - 600")
    if (updateData.price !== undefined) updateData.price = Number(updateData.price);
    if (updateData.beds !== undefined) updateData.beds = Number(updateData.beds);
    if (updateData.baths !== undefined) updateData.baths = Number(updateData.baths);
    if (updateData.size !== undefined) {
      const sizeVal = updateData.size;
      const str = String(sizeVal).trim();
      updateData.size = str.includes(" - ") ? str : (isNaN(Number(str)) ? str : Number(str));
    }

    // Validate 'for' field if provided
    if (updateData.for && !['buy', 'rent'].includes(updateData.for)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 'for' field. Must be 'buy' or 'rent'"
      });
    }

    const effectiveFor = updateData.for || property.for;
    if (effectiveFor !== 'rent' || updateData.rentDuration === "") {
      delete updateData.rentDuration;
    }

    // Remove undefined values and empty strings from nested objects to avoid overwriting with invalid data
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      } else if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
        // Clean nested objects - remove empty string values
        Object.keys(updateData[key]).forEach(nestedKey => {
          if (updateData[key][nestedKey] === '') {
            delete updateData[key][nestedKey];
          }
        });
        // If object is now empty, remove it
        if (Object.keys(updateData[key]).length === 0) {
          delete updateData[key];
        }
      }
    });

    // Update the document properties (property was already fetched on line 539)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        (property as any)[key] = updateData[key];
      }
    });

    // Mark modified fields to ensure they're saved
    if (updateData.title) property.markModified('title');
    if (updateData.location) property.markModified('location');
    if (updateData.description) property.markModified('description');
    if (updateData.seo) property.markModified('seo');
    if (updateData.amenities) property.markModified('amenities');
    if (updateData.images) property.markModified('images');
    if (updateData.agent) property.markModified('agent');
    if (updateData.buildingInfo) property.markModified('buildingInfo');
    if (updateData.brochure !== undefined) property.markModified('brochure');
    if (updateData.qrImage !== undefined) property.markModified('qrImage');
    if (updateData.dldPermitNumber !== undefined) property.markModified('dldPermitNumber');
    if (updateData.projectStatus !== undefined) property.markModified('projectStatus');
    if (updateData.rentDuration !== undefined) property.markModified('rentDuration');
    if (updateData.geoLocation !== undefined) property.markModified('geoLocation');

    // Save the document - this will trigger pre-save hooks and regenerate slugs
    const updated = await property.save();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Property not found after update" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("❌ Error updating property:", error);
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors
      });
    }

    // Handle cast errors (invalid ID, etc.)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error updating property",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ===========================
// DELETE PROPERTY
// Always deletes the entire property document
// ===========================
export const deleteProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Delete property request: id=${id}`);

    const property = await Property.findById(id);

    if (!property) {
      console.log(`❌ Property not found: ${id}`);
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    console.log(`✅ Property found: ${id}, title:`, property.title);

    // Get property title for notification before deletion
    const propertyTitle = typeof property.title === 'object' 
      ? (property.title.en || property.title.fr || property.title.es || 'Property')
      : (property.title || 'Property');

    // Create notification before deleting
    await createNotification(
      "property",
      "deleted",
      "Property Deleted",
      `Property "${propertyTitle}" has been deleted.`,
      String(property._id)
    );

    // Delete the entire property document first
    const deletedProperty = await Property.findByIdAndDelete(id);
    if (!deletedProperty) {
      console.log(`❌ Failed to delete property: ${id}`);
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Verify deletion
    const verifyDeleted = await Property.findById(id);
    if (verifyDeleted) {
      console.log(`❌ Property still exists after deletion attempt: ${id}`);
      return res.status(500).json({
        success: false,
        message: "Failed to delete property. Please try again."
      });
    }

    console.log(`✅ Successfully deleted property: ${id}`);
    res.status(200).json({ success: true, message: "Property deleted successfully" });
  } catch (error: any) {
    console.error("❌ Error deleting property:", error);
    res.status(500).json({ success: false, message: "Server error deleting property" });
  }
};

// ===========================
// GET SIMILAR PROPERTIES
// ===========================
export const getSimilarProperties = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 3, locale = 'en' } = req.query;

    // Fix: Properly type query parameters
    const limitNum = typeof limit === 'string' ? Number(limit) : 3;
    const localeString = typeof locale === 'string' ? locale : 'en';

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const similarProperties = await Property.find({
      _id: { $ne: id },
      $or: [
        { type: property.type },
        { "location.en": property.location.en },
        { for: property.for }
      ]
    })
      .limit(limitNum)
      .sort({ createdAt: -1 });

    console.log("📸 Similar properties found:", similarProperties.length);

    // Localize the properties based on locale
    const localizedProperties = localizeProperties(similarProperties, localeString);

    res.status(200).json({ success: true, data: localizedProperties });
  } catch (error: any) {
    console.error("❌ Error fetching similar properties:", error);
    res.status(500).json({ success: false, message: "Server error fetching similar properties" });
  }
};

// ===========================
// GET FEATURED PROPERTIES
// ===========================
export const getFeaturedProperties = async (req: Request, res: Response) => {
  try {
    const { limit = 6, locale = 'en' } = req.query;

    // Fix: Properly type query parameters
    const limitNum = typeof limit === 'string' ? Number(limit) : 6;
    const localeString = typeof locale === 'string' ? locale : 'en';

    const excludeContent = req.query.excludeContent === 'true';
    const featProjection = excludeContent ? '-description' : '';
    const featQuery = Property.find({}).limit(limitNum).sort({ createdAt: -1 });
    const featuredProperties = await (featProjection ? featQuery.select(featProjection) : featQuery);

    console.log("📸 Featured properties found:", featuredProperties.length);

    // Localize the properties based on locale
    const localizedProperties = localizeProperties(featuredProperties, localeString);

    res.status(200).json({
      success: true,
      data: localizedProperties
    });
  } catch (error: any) {
    console.error("❌ Error fetching featured properties:", error);
    res.status(500).json({ success: false, message: "Server error fetching featured properties" });
  }
};

// ===========================
// BULK CREATE PROPERTIES (FOR TESTING)
// ===========================
export const bulkCreateProperties = async (req: Request, res: Response) => {
  try {
    const { properties } = req.body;

    if (!Array.isArray(properties)) {
      return res.status(400).json({ success: false, message: "Properties must be an array" });
    }

    const createdProperties = await Property.insertMany(properties);

    res.status(201).json({
      success: true,
      data: createdProperties,
      message: `Successfully created ${createdProperties.length} properties`
    });
  } catch (error: any) {
    console.error("❌ Error bulk creating properties:", error);
    res.status(500).json({ success: false, message: "Server error bulk creating properties" });
  }
};

// ===========================
// GET PROPERTY COUNT BY TYPE
// ===========================
export const getPropertyCounts = async (req: Request, res: Response) => {
  try {
    const counts = await Property.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error: any) {
    console.error("❌ Error fetching property counts:", error);
    res.status(500).json({ success: false, message: "Server error fetching property counts" });
  }
};