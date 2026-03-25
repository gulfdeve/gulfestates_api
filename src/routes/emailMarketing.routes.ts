import express from "express";
import {
  getRecipients,
  createEmailCampaign,
  getAllCampaigns,
  getCampaignById,
  deleteCampaign,
} from "../controllers/emailMarketing.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { uploadEmailMarketingImage } from "../utils/multerCloudinary.js";

const router = express.Router();

// Get recipients based on audience type
router.get("/recipients", protect, restrictToAdmin, getRecipients);

// Get all campaigns
router.get("/", protect, restrictToAdmin, getAllCampaigns);

// Get single campaign
router.get("/:id", protect, restrictToAdmin, getCampaignById);

// Create email campaign (with image upload support)
router.post("/", protect, restrictToAdmin, uploadEmailMarketingImage.single("image"), createEmailCampaign);

// Delete campaign
router.delete("/:id", protect, restrictToAdmin, deleteCampaign);

export default router;

