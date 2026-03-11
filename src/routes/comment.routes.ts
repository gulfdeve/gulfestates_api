import express from "express";
import {
  createComment,
  getAllComments,
  getApprovedCommentsByBlog,
  approveComment,
  deleteComment,
} from "../controllers/comment.controller.js";
import { protect, restrictToAdminOrCustomerManager } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public - submit comment (no auth)
router.post("/", createComment);

// Public - get approved comments for a blog (?blog=blogId) - must be before /:id
router.get("/by-blog", getApprovedCommentsByBlog);

// Protected - admin or customer-manager (for Clients section)
router.get("/", protect, restrictToAdminOrCustomerManager, getAllComments);
router.patch("/:id/approve", protect, restrictToAdminOrCustomerManager, approveComment);
router.delete("/:id", protect, restrictToAdminOrCustomerManager, deleteComment);

export default router;
