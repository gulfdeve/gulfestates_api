import express from "express";
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
import { uploadOffPlanFiles } from "../utils/multerCloudinary.js";

const router = express.Router();

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

// OffPlan routes with file uploads (images + PDF brochure streamed directly to Cloudinary)
router.post("/", protect, restrictToAdmin, uploadOffPlanFiles.any(), createOffPlan);
router.put("/:id", protect, restrictToAdmin, uploadOffPlanFiles.any(), updateOffPlan);

router.delete("/:id", protect, restrictToAdmin, deleteOffPlan);

export default router;