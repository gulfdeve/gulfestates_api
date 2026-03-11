import express from "express";
import multer from "multer";
import {
  getRecipients,
  createEmailCampaign,
  getAllCampaigns,
  getCampaignById,
  deleteCampaign,
} from "../controllers/emailMarketing.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { isDangerousFile, isAllowedImage } from "../utils/fileSecurity.util.js";
import path from "path";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + "." + file.originalname.split(".").pop()
    );
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked.`));
  }

  // Only allow images for email campaigns
  if (isAllowedImage(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    return cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Get recipients based on audience type
router.get("/recipients", protect, restrictToAdmin, getRecipients);

// Get all campaigns
router.get("/", protect, restrictToAdmin, getAllCampaigns);

// Get single campaign
router.get("/:id", protect, restrictToAdmin, getCampaignById);

// Create email campaign (with image upload support)
router.post("/", protect, restrictToAdmin, upload.single("image"), createEmailCampaign);

// Delete campaign
router.delete("/:id", protect, restrictToAdmin, deleteCampaign);

export default router;

