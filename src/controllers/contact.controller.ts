import { Request, Response } from "express";
import Contact from "../models/contact.js";
import { createNotification } from "./notification.controller.js";
import { sendContactNotificationEmail } from "../utils/contactEmail.util.js";

export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, countryCode, phone, message } = req.body;

    if (!name || !email || !countryCode || !phone || !message) {
      res.status(400).json({ success: false, message: "All fields are required" });
      return;
    }

    const newContact = await Contact.create({
      name,
      email,
      countryCode,
      phone,
      message,
    });

    // Create notification
    await createNotification(
      "contact",
      "created",
      "New Contact Form Submission",
      `New contact form submission from "${name}" (${email}).`,
      newContact._id.toString()
    );

    // Send email notification
    await sendContactNotificationEmail({
      name,
      email,
      countryCode,
      phone,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Message submitted successfully!",
      data: newContact,
    });
  } catch (error: any) {
    console.error("Error creating contact:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not save contact.",
      error: error.message,
    });
  }
};

/**
 * GET /api/contact
 * Retrieve all contact submissions (for admin)
 */
export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch contacts.",
      error: error.message,
    });
  }
};

/**
 * GET /api/contact/:id
 * Get a single contact by ID
 */
export const getContactById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const contact = await Contact.findById(id);

    if (!contact) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    res.status(200).json({ success: true, data: contact });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch contact.",
      error: error.message,
    });
  }
};

/**
 * PUT /api/contact/:id
 * Update a contact submission
 */
export const updateContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, countryCode, phone, message } = req.body;

    const contact = await Contact.findByIdAndUpdate(
      id,
      { name, email, countryCode, phone, message },
      { new: true, runValidators: true }
    );

    if (!contact) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Contact updated successfully",
      data: contact,
    });
  } catch (error: any) {
    console.error("Error updating contact:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not update contact.",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/contact/:id
 * Delete a contact submission
 */
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting contact:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not delete contact.",
      error: error.message,
    });
  }
};