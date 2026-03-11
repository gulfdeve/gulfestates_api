import { Request, Response } from "express";
import HomePageLead from "../models/HomePageLead.js";
import { createNotification } from "./notification.controller.js";
import { sendHomePageLeadEmail } from "../utils/homePageLeadEmail.util.js";
import escapeStringRegexp from "escape-string-regexp";

/**
 * POST /api/home-page-leads
 * Save homepage lead form submission
 */
export const createHomePageLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phoneNumber, country, countryCode, budget, propertyType, consent } = req.body;

    // Validate required fields
    if (!fullName || !email || !phoneNumber || !country || !countryCode) {
      res.status(400).json({ 
        success: false, 
        message: "Full name, email, phone number, country, and country code are required" 
      });
      return;
    }

    // Validate budget and propertyType if provided (should not be default values)
    if (budget && budget === "Select Budget") {
      res.status(400).json({ 
        success: false, 
        message: "Please select a valid budget" 
      });
      return;
    }

    if (propertyType && propertyType === "Property Type") {
      res.status(400).json({ 
        success: false, 
        message: "Please select a valid property type" 
      });
      return;
    }

    const newLead = await HomePageLead.create({
      fullName,
      email,
      phoneNumber,
      country,
      countryCode,
      budget: budget || "Select Budget",
      propertyType: propertyType || "Property Type",
      consent: consent || false,
      source: "From Homepage Popup",
      status: "New",
    });

   try {
     // Create notification
     await createNotification(
      "homepage_lead",
      "created",
      "New Homepage Lead",
      `New homepage lead from "${fullName}" (${email}).`,
      newLead._id.toString()
    );
   } catch (error) {
    console.log("Error creating notification on homepage lead:", error);
   }
    try {
      // Send email notification
      await sendHomePageLeadEmail({
        fullName,
        email,
        phoneNumber,
        country,
        countryCode,
        budget,
        propertyType,
        consent: consent || false,
        // submissionDate: newLead.createdAt,
        submissionDate: new Date(),
      });
    } catch (error) {
      console.log("Error sending email notification on homepage lead:", error);
    }


    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully!",
      // data: newLead,
    });
  } catch (error: any) {
    console.error("Error creating homepage lead:", error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: "An enquiry with this email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Server error. Could not save enquiry.",
      error: error.message,
    });
  }
};

/**
 * GET /api/home-page-leads
 * Retrieve all homepage leads (for admin)
 */
export const getHomePageLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    
    if (status) {
      query.status = status;
    }

    if (search && typeof search === 'string') {
      const sanitizedSearch = escapeStringRegexp(search);
      query.$or = [
        { fullName: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
        { phoneNumber: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    const leads = await HomePageLead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await HomePageLead.countDocuments(query);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Error fetching homepage leads:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch leads.",
      error: error.message,
    });
  }
};

/**
 * GET /api/home-page-leads/:id
 * Get a single homepage lead by ID
 */
export const getHomePageLeadById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lead = await HomePageLead.findById(id);

    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error: any) {
    console.error("Error fetching homepage lead:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch lead.",
      error: error.message,
    });
  }
};

/**
 * PUT /api/home-page-leads/:id
 * Update a homepage lead
 */
export const updateHomePageLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, country, countryCode, budget, propertyType, consent, status } = req.body;

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (country !== undefined) updateData.country = country;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (budget !== undefined) updateData.budget = budget;
    if (propertyType !== undefined) updateData.propertyType = propertyType;
    if (consent !== undefined) updateData.consent = consent;
    if (status !== undefined) updateData.status = status;

    const lead = await HomePageLead.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error: any) {
    console.error("Error updating homepage lead:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not update lead.",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/home-page-leads/:id
 * Delete a homepage lead
 */
export const deleteHomePageLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lead = await HomePageLead.findByIdAndDelete(id);

    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting homepage lead:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not delete lead.",
      error: error.message,
    });
  }
};

/**
 * GET /api/home-page-leads/stats/summary
 * Get summary statistics for homepage leads
 */
export const getHomePageLeadStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const total = await HomePageLead.countDocuments();
    const newLeads = await HomePageLead.countDocuments({ status: "New" });
    const contacted = await HomePageLead.countDocuments({ status: "Contacted" });
    const qualified = await HomePageLead.countDocuments({ status: "Qualified" });
    const converted = await HomePageLead.countDocuments({ status: "Converted" });
    const lost = await HomePageLead.countDocuments({ status: "Lost" });

    // Get leads from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLeads = await HomePageLead.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        new: newLeads,
        contacted,
        qualified,
        converted,
        lost,
        recent: recentLeads,
      },
    });
  } catch (error: any) {
    console.error("Error fetching homepage lead stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch statistics.",
      error: error.message,
    });
  }
};

