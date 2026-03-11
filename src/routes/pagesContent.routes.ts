import express from "express";
import {
  getAllPagesContent,
  getPageContentById,
  getPageContentByType,
  createPageContent,
  updatePageContent,
  deletePageContent,
} from "../controllers/pagesContent.controller.js";
import { protect, restrictToSuperAdmin } from "../middleware/auth.middleware.js";
import { pagesContentRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Routes
// List all pages content - Superadmin only (with pagination)
router.get("/", protect, restrictToSuperAdmin, getAllPagesContent);

// Public routes with rate limiting
router.get("/type/:pageType", pagesContentRateLimiter, getPageContentByType);
router.get("/:id", pagesContentRateLimiter, getPageContentById);

// Protected routes - Superadmin only
router.post("/", protect, restrictToSuperAdmin, createPageContent);
router.put("/:id", protect, restrictToSuperAdmin, updatePageContent);
router.delete("/:id", protect, restrictToSuperAdmin, deletePageContent);

export default router;
