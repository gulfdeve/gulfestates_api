import express from "express";
import multer from 'multer';
import {
  getAllOffPlans,
  getOffPlanById,
  createOffPlan,
  updateOffPlan,
  deleteOffPlan,
  getSimilarOffPlans,
  getFeaturedOffPlans,
  searchOffPlans,
  syncOffPlansFromExternalAPI,
  addSpanishTranslations,
  translateOffPlanTitles,
  translateAllOffPlanFields,
  replaceAmenities,
  clearAllAmenities,
  fixBrochureUrls
} from "../controllers/offPlanController.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { offPlanRateLimiter } from "../middleware/rateLimiter.middleware.js";
import { isDangerousFile, isAllowedImage, isAllowedPDF } from "../utils/fileSecurity.util.js";
import path from "path";

const router = express.Router();

// Configure multer for multiple file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked for security.`));
  }

  // Allow images for 'images', 'image', and 'qrImage' fields
  if (file.fieldname === 'images' || file.fieldname === 'image' || file.fieldname === 'qrImage') {
    if (isAllowedImage(file.originalname, file.mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Only image files (JPEG, JPG, PNG, WEBP, AVIF) are allowed!'));
    }
  }

  // Allow PDF for 'brochure' field
  if (file.fieldname === 'brochure') {
    if (isAllowedPDF(file.originalname, file.mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Only PDF files are allowed for brochures!'));
    }
  }

  cb(new Error('Invalid file field name'));
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit (for PDF brochures; images have separate validation)
  },
  fileFilter: fileFilter
});

// Public routes - Rate limited: 100 requests per hour per IP (admins excluded)
router.get("/", offPlanRateLimiter, getAllOffPlans);
router.get("/search", offPlanRateLimiter, searchOffPlans);
router.get("/featured", offPlanRateLimiter, getFeaturedOffPlans);
router.get("/sync", protect, syncOffPlansFromExternalAPI); // Sync from external API (protected)

router.post("/add-spanish", protect, addSpanishTranslations); // Add Spanish translations to existing offplans
router.post("/translate-titles", protect, translateOffPlanTitles); // Add French and Spanish translations for titles that only have English
router.post("/translate-all", protect, translateAllOffPlanFields); // Translate all fields (title, location, description) from English to French and Spanish
router.post("/amenities/replace", protect, replaceAmenities); // Replace coded amenities with proper names
router.delete("/amenities/clear", protect, clearAllAmenities); // Clear all amenities from all offplans
router.post("/fix-brochures", protect, fixBrochureUrls); // Fix existing brochure URLs by making them public
router.get("/:id/similar", offPlanRateLimiter, getSimilarOffPlans);
router.get("/:id", offPlanRateLimiter, getOffPlanById);

// OffPlan routes with file uploads
// Using upload.any() to allow both file uploads and URL strings for brochure/qrImage fields
// Accessible to both 'admin' and 'superadmin' roles
// Note: If user has access to create (POST) and view (GET), they automatically have access to edit (PUT)
router.post("/", protect, restrictToAdmin, upload.any(), createOffPlan);

router.put("/:id", protect, restrictToAdmin, upload.any(), updateOffPlan);

router.delete("/:id", protect, restrictToAdmin, deleteOffPlan);

export default router;