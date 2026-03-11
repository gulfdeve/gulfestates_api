// controllers/job.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Job, { IJob } from "../models/job.model.js";
import { getLocalizedDocuments, getLocalizedDocument } from "../utils/localization.util.js";
import { createNotification } from "./notification.controller.js";

// Create Job
export const createJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      location,
      type,
      status,
      department,
      experience,
      salary,
      seo,
      languages
    } = req.body;

    console.log("🔍 DEBUG - Job creation request body:", req.body);

    // Handle language-only jobs (French/Spanish only, no English)
    // If title/description are empty but languages are provided, use a placeholder
    let finalTitle = title || "";
    let finalDescription = description || "";

    // Check if this is a language-only job (no English content but has language content)
    const hasLanguageContent = (languages?.fr?.title && languages.fr.title.trim() !== "") ||
      (languages?.es?.title && languages.es.title.trim() !== "");
    const hasEnglishContent = finalTitle.trim() !== "" || finalDescription.trim() !== "";

    // If only language content exists (no English), use placeholder text
    if (!hasEnglishContent && hasLanguageContent) {
      finalTitle = "LANGUAGE_ONLY_PLACEHOLDER";
      finalDescription = "LANGUAGE_ONLY_PLACEHOLDER";
    }

    // Validate that we have at least some content
    if (!finalTitle.trim() && !hasLanguageContent) {
      res.status(400).json({
        success: false,
        message: "Job title is required in at least one language",
      });
      return;
    }

    // Validate enum values
    const validLocations = ["On-site", "Remote", "Hybrid"];
    const validTypes = ["Full Time", "Part Time", "Contract"];
    const validStatuses = ["Open", "Closed"];
    const validExperiences = ["Entry Level", "Mid Level", "Senior"];

    const finalLocation = validLocations.includes(location) ? location : "On-site";
    const finalType = validTypes.includes(type) ? type : "Full Time";
    const finalStatus = validStatuses.includes(status) ? status : "Open";

    // Only set experience if it's valid
    let finalExperience: string | undefined = undefined;
    if (experience && validExperiences.includes(experience)) {
      finalExperience = experience;
    }

    // Prepare job data
    const jobData: any = {
      title: finalTitle,
      description: finalDescription,
      location: finalLocation,
      type: finalType,
      status: finalStatus,
      languages: languages || {}
    };

    // Only add optional fields if they have values
    if (department && department.trim() !== "") {
      jobData.department = department.trim();
    }
    if (finalExperience) {
      jobData.experience = finalExperience;
    }
    if (salary && salary.trim() !== "") {
      jobData.salary = salary.trim();
    }
    // Only add seo if it exists and has at least one field
    if (seo && (seo.title || seo.description)) {
      jobData.seo = {
        ...(seo.title && { title: seo.title }),
        ...(seo.description && { description: seo.description })
      };
    }

    console.log("🔍 DEBUG - Job data to create:", jobData);

    const job = await Job.create(jobData);

    // Create notification
    await createNotification(
      "job",
      "created",
      "New Job Added",
      `A new job "${title}" has been added.`,
      String(job._id)
    );

    res.status(201).json({
      success: true,
      message: "Job created successfully.",
      data: job,
    });
  } catch (error: any) {
    console.error("❌ Error creating job:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: "Job with similar details already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Get All Jobs with Pagination
export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const locale = (req.query.locale as string) || 'en';
    const status = req.query.status as string;
    const location = req.query.location as string;
    const type = req.query.type as string;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: Record<string, any> = {};

    // Language-specific filtering - only show jobs with content in the requested language
    if (locale === 'en') {
      // For English: must have English title that is not the placeholder
      // Exclude jobs that only have French/Spanish content
      filter.title = {
        $exists: true,
        $ne: "",
        $nin: [null, "", "LANGUAGE_ONLY_PLACEHOLDER"],
        $not: /^\s*$/ // Exclude titles that are only whitespace
      };
    } else if (locale === 'fr') {
      // For French: must have French title in languages.fr.title
      // Exclude jobs that don't have French content
      filter["languages.fr.title"] = { $exists: true, $ne: "", $nin: [null, ""] };
    } else if (locale === 'es') {
      // For Spanish: must have Spanish title in languages.es.title
      // Exclude jobs that don't have Spanish content
      filter["languages.es.title"] = { $exists: true, $ne: "", $nin: [null, ""] };
    }

    // Status filter (default to Open only for public)
    if (status) {
      filter.status = status;
    } else {
      // For public API, only show open jobs unless admin view
      const isAdminView = req.headers['x-admin-view'] === 'true' || req.query.admin === 'true';
      if (!isAdminView) {
        filter.status = "Open";
      }
    }

    // Location filter
    if (location) {
      filter.location = location;
    }

    // Type filter
    if (type) {
      filter.type = type;
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(filter)
    ]);

    // Localize the jobs based on locale - custom function for jobs structure
    const localizedJobs = jobs.map((job: any) => {
      const jobObj = job.toObject ? job.toObject() : job;

      // For non-English locales, use the language-specific content
      if (locale === 'fr' && jobObj.languages?.fr) {
        return {
          ...jobObj,
          title: jobObj.languages.fr.title || jobObj.title || '',
          description: jobObj.languages.fr.description || jobObj.description || '',
        };
      } else if (locale === 'es' && jobObj.languages?.es) {
        return {
          ...jobObj,
          title: jobObj.languages.es.title || jobObj.title || '',
          description: jobObj.languages.es.description || jobObj.description || '',
        };
      }

      // For English, use the main title/description fields
      return jobObj;
    });

    res.status(200).json({
      success: true,
      data: {
        items: localizedJobs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching jobs",
      error: error.message,
    });
  }
};

// Get Job by ID
export const getJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const locale = (req.query.locale as string) || 'en';
    const isAdminView = req.headers['x-admin-view'] === 'true' || req.query.admin === 'true';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid job ID"
      });
      return;
    }

    const job = await Job.findById(id);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job not found"
      });
      return;
    }

    // For admin view, return full job with all languages
    if (isAdminView) {
      const jobObject = job.toObject ? job.toObject() : job;
      res.status(200).json({
        success: true,
        data: jobObject
      });
      return;
    }

    // For public view, localize based on locale
    const localizedJob = getLocalizedDocument(job, locale);

    res.status(200).json({
      success: true,
      data: localizedJob
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching job",
      error: error.message
    });
  }
};

// Update Job
export const updateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid job ID"
      });
      return;
    }

    const job = await Job.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job not found",
      });
      return;
    }

    // Create notification
    await createNotification(
      "job",
      "updated",
      "Job Updated",
      `Job "${job.title}" has been updated.`,
      String(job._id)
    );

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: job,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating job",
      error: error.message,
    });
  }
};

// Delete Job
export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid job ID"
      });
      return;
    }

    const job = await Job.findById(id);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job not found",
      });
      return;
    }

    // Create notification before deleting
    await createNotification(
      "job",
      "deleted",
      "Job Deleted",
      `Job "${job.title}" has been deleted.`,
      String(job._id)
    );

    await Job.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: error.message,
    });
  }
};


