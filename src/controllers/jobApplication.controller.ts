// controllers/jobApplication.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import JobApplication, { IJobApplication } from "../models/jobApplication.model.js";
import Job from "../models/job.model.js";
import { createNotification } from "./notification.controller.js";

// Create Job Application
export const createJobApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, firstName, lastName, email, coverLetter } = req.body;

    // Validate required fields
    if (!jobId || !firstName || !lastName || !email || !coverLetter) {
      res.status(400).json({
        success: false,
        message: "All fields are required (jobId, firstName, lastName, email, coverLetter)",
      });
      return;
    }

    // Validate jobId
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
      return;
    }

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job not found",
      });
      return;
    }

    // Check if job is open
    if (job.status !== "Open") {
      res.status(400).json({
        success: false,
        message: "This job is not currently accepting applications",
      });
      return;
    }

    // Get Cloudinary URLs from req.files
    // When using CloudinaryStorage, the path property contains the Cloudinary secure_url
    const resumeFile = (req.files as any)?.resume?.[0];
    const portfolioFile = (req.files as any)?.portfolio?.[0];
    
    // CloudinaryStorage stores the secure_url in the path property
    // The file object structure: { path: 'https://res.cloudinary.com/...', ... }
    const resume = resumeFile?.path || req.body.resume;
    const portfolio = portfolioFile?.path || req.body.portfolio;
    
    console.log("📄 Resume file:", resumeFile ? { path: resumeFile.path, size: resumeFile.size } : "Not found");
    console.log("📄 Portfolio file:", portfolioFile ? { path: portfolioFile.path, size: portfolioFile.size } : "Not found");

    // Validate resume is provided
    if (!resume) {
      res.status(400).json({
        success: false,
        message: "Resume is required",
      });
      return;
    }

    // Create application
    const application = await JobApplication.create({
      jobId,
      firstName,
      lastName,
      email,
      coverLetter,
      resume,
      portfolio: portfolio || undefined,
      status: "Pending",
    });

    // Create notification
    await createNotification(
      "job_application",
      "created",
      "New Job Application",
      `New application received for "${job.title}" from ${firstName} ${lastName}.`,
      String(application._id)
    );

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (error: any) {
    console.error("Error creating job application:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting application",
      error: error.message,
    });
  }
};

// Get All Job Applications (for admin)
export const getJobApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const jobId = req.query.jobId as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: Record<string, any> = {};

    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      filter.jobId = jobId;
    }

    if (status) {
      filter.status = status;
    }

    const [applications, total] = await Promise.all([
      JobApplication.find(filter)
        .populate("jobId", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      JobApplication.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: applications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
      error: error.message,
    });
  }
};

// Get Job Application by ID
export const getJobApplicationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
      return;
    }

    const application = await JobApplication.findById(id).populate("jobId", "title");

    if (!application) {
      res.status(404).json({
        success: false,
        message: "Application not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching application",
      error: error.message,
    });
  }
};

// Update Job Application Status (for admin)
export const updateJobApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
      return;
    }

    if (status && !["Pending", "Reviewed", "Accepted", "Rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: Pending, Reviewed, Accepted, Rejected",
      });
      return;
    }

    const application = await JobApplication.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate("jobId", "title");

    if (!application) {
      res.status(404).json({
        success: false,
        message: "Application not found",
      });
      return;
    }

    // Create notification
    if (status) {
      await createNotification(
        "job_application",
        "updated",
        "Application Status Updated",
        `Application status updated to "${status}" for "${application.jobId}".`,
        String(application._id)
      );
    }

    res.status(200).json({
      success: true,
      message: "Application updated successfully",
      data: application,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating application",
      error: error.message,
    });
  }
};

// Delete Job Application
export const deleteJobApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
      return;
    }

    const application = await JobApplication.findByIdAndDelete(id);

    if (!application) {
      res.status(404).json({
        success: false,
        message: "Application not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting application",
      error: error.message,
    });
  }
};

