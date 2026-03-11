import express from "express";
import {
  getTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from "../controllers/testimonial.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { testimonialRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Public routes
router.get("/", testimonialRateLimiter, getTestimonials);
router.get("/:id", testimonialRateLimiter, getTestimonialById);

// Protected routes (require authentication and admin role)
// Note: If user has access to create (POST) and view (GET), they automatically have access to edit (PUT)
router.post("/", protect, restrictToAdmin, createTestimonial);
router.put("/:id", protect, restrictToAdmin, updateTestimonial);
router.delete("/:id", protect, restrictToAdmin, deleteTestimonial);

export default router;

