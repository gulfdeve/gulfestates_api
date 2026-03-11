// routes/job.routes.ts
import express from "express";
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} from "../controllers/job.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getJobs);
router.get("/:id", getJobById);

// Protected routes (require authentication)
router.post("/", protect, createJob);
router.put("/:id", protect, updateJob);
router.delete("/:id", protect, deleteJob);

export default router;


