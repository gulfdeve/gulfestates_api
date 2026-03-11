import { Request, Response } from "express";
import RegisterInterest from "../models/RegisterInterest.js";

/**
 * @desc Handle form submissions for Register Interest
 * @route POST /api/register-interest
 */
export const createRegisterInterest = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, countryCode, projectName } = req.body;

    if (!name || !email || !phone || !projectName) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided.",
      });
    }

    const newEntry = new RegisterInterest({
      name,
      email,
      phone,
      countryCode,
      projectName,
    });

    await newEntry.save();

    return res.status(201).json({
      success: true,
      message: "Your interest has been registered successfully.",
      data: newEntry,
    });
  } catch (err: any) {
    console.error("Error in register interest:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

/**
 * @desc Get all form submissions (Admin view)
 * @route GET /api/register-interest
 */
export const getAllRegisterInterests = async (req: Request, res: Response) => {
  try {
    const submissions = await RegisterInterest.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: submissions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to fetch data." });
  }
};
