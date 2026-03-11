// routes/blog.routes.js
import express from "express";
import {
  createBlog,
  getBlogs,
  getFeaturedBlog,
  getBlogByIdOrSlug,
  updateBlog,
  deleteBlog,
} from "../controllers/blog.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { blogRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Public routes - Rate limited: 50 requests per 2 hours per IP (admins excluded)
router.get("/", blogRateLimiter, getBlogs);
router.get("/featured", blogRateLimiter, getFeaturedBlog);
router.get("/:idOrSlug", blogRateLimiter, getBlogByIdOrSlug);

// Protected routes (require authentication and admin role)
// Accessible to both 'admin' and 'superadmin' roles
// Note: If user has access to create (POST) and view (GET), they automatically have access to edit (PUT)
router.post("/", protect, restrictToAdmin, createBlog);
router.put("/:idOrSlug", protect, restrictToAdmin, updateBlog);
router.delete("/:idOrSlug", protect, restrictToAdmin, deleteBlog);

export default router;