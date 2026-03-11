// routes/jobApplication.routes.ts
import express from "express";
import {
  createJobApplication,
  getJobApplications,
  getJobApplicationById,
  updateJobApplication,
  deleteJobApplication,
} from "../controllers/jobApplication.controller.js";
import { protect, restrictToCustomerManager } from "../middleware/auth.middleware.js";
import { uploadJobResume } from "../utils/multerCloudinary.js";
import { jobApplicationRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Public route - submit application
router.post(
  "/",
  jobApplicationRateLimiter,
  uploadJobResume.fields([
    { name: "resume", maxCount: 1 },
    { name: "portfolio", maxCount: 1 },
  ]),
  createJobApplication
);

// Protected routes (require authentication) - for customer-manager
router.get("/", protect, restrictToCustomerManager, getJobApplications);
router.get("/:id", protect, restrictToCustomerManager, getJobApplicationById);
router.put("/:id", protect, restrictToCustomerManager, updateJobApplication);
router.delete("/:id", protect, restrictToCustomerManager, deleteJobApplication);

export default router;

