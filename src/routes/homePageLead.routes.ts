import express from "express";
import { 
  createHomePageLead, 
  getHomePageLeads, 
  getHomePageLeadById, 
  updateHomePageLead, 
  deleteHomePageLead,
  getHomePageLeadStats
} from "../controllers/homePageLead.controller.js";
import { protect, restrictToCustomerManager } from "../middleware/auth.middleware.js";
import { homePageLeadRateLimiter } from "../middleware/rateLimiter.middleware.js";
import { homePageLeadValidation, validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// POST - user submits form (public) - Rate limited: 30 requests per day per IP
router.post("/", homePageLeadRateLimiter, homePageLeadValidation, validate, createHomePageLead);

// GET - customer-manager views all submissions with pagination and filters (protected)
router.get("/", protect, restrictToCustomerManager, getHomePageLeads);

// GET - customer-manager gets statistics (protected)
router.get("/stats/summary", protect, restrictToCustomerManager, getHomePageLeadStats);

// GET - customer-manager gets single lead by ID (protected)
router.get("/:id", protect, restrictToCustomerManager, getHomePageLeadById);

// PUT - customer-manager updates lead (protected)
router.put("/:id", protect, restrictToCustomerManager, updateHomePageLead);

// DELETE - customer-manager deletes lead (protected)
router.delete("/:id", protect, restrictToCustomerManager, deleteHomePageLead);

export default router;

