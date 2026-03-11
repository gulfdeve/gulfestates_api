import express from "express";
import { 
  createContact, 
  getContacts, 
  getContactById, 
  updateContact, 
  deleteContact 
} from "../controllers/contact.controller.js";
import { protect, restrictToCustomerManager } from "../middleware/auth.middleware.js";
import { contactRateLimiter } from "../middleware/rateLimiter.middleware.js";
import { contactValidation, validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// POST - user submits form (public) - Rate limited: 30 requests per day per IP
router.post("/", contactRateLimiter, contactValidation, validate, createContact);

// GET - customer-manager views all submissions (protected)
router.get("/", protect, restrictToCustomerManager, getContacts);

// GET - customer-manager gets single contact by ID (protected)
router.get("/:id", protect, restrictToCustomerManager, getContactById);

// PUT - customer-manager updates contact (protected)
router.put("/:id", protect, restrictToCustomerManager, updateContact);

// DELETE - customer-manager deletes contact (protected)
router.delete("/:id", protect, restrictToCustomerManager, deleteContact);

export default router;
