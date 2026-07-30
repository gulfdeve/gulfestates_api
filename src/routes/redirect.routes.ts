import express from "express";
import {
  resolveEntityRedirect,
  listEntityRedirects,
  addEntityRedirect,
  deleteEntityRedirect,
} from "../controllers/redirect.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.middleware.js";
import { generalApiRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Public: used by the frontend to resolve a stale slug to its current one
router.get("/resolve/:entityType/:locale/:slug", generalApiRateLimiter, resolveEntityRedirect);

// Admin: manage redirects for a specific off-plan/property
router.get("/:entityType/:id", protect, restrictToAdmin, listEntityRedirects);
router.post("/:entityType/:id", protect, restrictToAdmin, addEntityRedirect);
router.delete("/:entityType/:id/:redirectId", protect, restrictToAdmin, deleteEntityRedirect);

export default router;
