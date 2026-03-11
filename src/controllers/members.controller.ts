import { Request, Response } from "express";
import Team from "../models/team.model.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { downloadAndUploadImage } from "../utils/imageDownloader.js";
import fs from "fs";

// Helper function to upload image file to Cloudinary
const uploadImageToCloudinary = async (filePath: string, folder: string = 'team/members'): Promise<string> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `gulf-estates/${folder}`,
      resource_type: 'image',
      // No transformation - preserve original image without cropping
    });
    
    // Delete local file after upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return result.secure_url;
  } catch (error: any) {
    // Delete local file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

// Helper function to process image (file, URL, or base64)
const processImage = async (imageData: any, folder: string = 'team/members'): Promise<string> => {
  try {
    // Return empty string if imageData is empty or invalid
    if (!imageData || imageData === "" || (typeof imageData === 'string' && imageData.trim() === "")) {
      return "";
    }

    // If it's already a Cloudinary URL, return it
    if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
      return imageData;
    }

    // If it's a file path (from multer), upload it
    if (typeof imageData === 'string' && fs.existsSync(imageData)) {
      return await uploadImageToCloudinary(imageData, folder);
    }

    // If it's a URL (not Cloudinary), download and upload
    if (typeof imageData === 'string' && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
      return await downloadAndUploadImage(imageData, folder);
    }

    // If it's base64, convert and upload
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        return "";
      }
      const buffer = Buffer.from(base64Data, 'base64');
      const tempPath = `uploads/temp-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      // Ensure uploads directory exists
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
      }
      
      fs.writeFileSync(tempPath, buffer);
      return await uploadImageToCloudinary(tempPath, folder);
    }

    // Return original value if we can't process it
    return imageData || "";
  } catch (error: any) {
    console.error('Error processing image:', error);
    // Return original value if processing fails
    return imageData || "";
  }
};

export const getAllMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const team = await Team.findOne().select("team");

    if (!team?.team) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: team.team,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching members:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch members.",
      error: error.message,
    });
    return;
  }
};

export const getMemberById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
      return;
    }

    // Use aggregation pipeline to find member by ID
    const result = await Team.aggregate([
      { $match: {} },
      {
        $project: {
          member: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$team",
                  as: "member",
                  cond: { $eq: ["$$member._id", new mongoose.Types.ObjectId(id)] }
                }
              },
              0
            ]
          }
        }
      }
    ]);

    if (!result || result.length === 0 || !result[0].member) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result[0].member,
    });
  } catch (error: any) {
    console.error("Error fetching member:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch member.",
      error: error.message,
    });
  }
};

export const createMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, role, image, department } = req.body;

    // Validate required fields
    if (!name || !role || !image || !department) {
      res.status(400).json({
        success: false,
        message: "Name, role, image, and department are required",
      });
      return;
    }

    // Check if team exists
    const teamExists = await Team.findOne();
    if (!teamExists) {
      res.status(404).json({
        success: false,
        message: "Team data not found. Please create team data first.",
      });
      return;
    }

    // Create new member object
    const newMember = {
      _id: new mongoose.Types.ObjectId(),
      name: name.trim(),
      role: role.trim(),
      image: image.trim(),
      department: department.trim(),
    };

    // Add member to team array using $push with MongoDB update
    const result = await Team.updateOne(
      {},
      { $push: { team: newMember } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }

    // Get the newly created member using aggregation
    const createdMemberResult = await Team.aggregate([
      { $match: {} },
      {
        $project: {
          member: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$team",
                  as: "member",
                  cond: { $eq: ["$$member._id", newMember._id] }
                }
              },
              0
            ]
          }
        }
      }
    ]);

    const createdMember = createdMemberResult[0]?.member;

    res.status(201).json({
      success: true,
      message: "Team member created successfully",
      data: createdMember,
    });
  } catch (error: any) {
    console.error("Error creating member:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not create member.",
      error: error.message,
    });
  }
};

export const updateMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let { name, role, image, department } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
      return;
    }

    // Check if member exists using aggregation
    const memberExistsResult = await Team.aggregate([
      { $match: {} },
      {
        $project: {
          memberExists: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$team",
                    as: "member",
                    cond: { $eq: ["$$member._id", new mongoose.Types.ObjectId(id)] }
                  }
                }
              },
              0
            ]
          },
          existingMember: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$team",
                  as: "member",
                  cond: { $eq: ["$$member._id", new mongoose.Types.ObjectId(id)] }
                }
              },
              0
            ]
          }
        }
      }
    ]);

    if (!memberExistsResult || memberExistsResult.length === 0 || !memberExistsResult[0].memberExists) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      });
      return;
    }

    const existingMember = memberExistsResult[0].existingMember;

    // Handle file uploads (multer)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    
    // Process member image
    if (image !== undefined) {
      if (files?.image && files.image[0]) {
        // Image comes from file upload
        image = await uploadImageToCloudinary(files.image[0].path, 'team/members');
      } else if (image && image !== existingMember?.image) {
        // Only process if image has changed
        image = await processImage(image, 'team/members');
      }
    }

    // Build update object with arrayFilters
    const updateData: any = {};
    const memberObjectId = new mongoose.Types.ObjectId(id);
    const arrayFilters: any[] = [{ "member._id": memberObjectId }];

    if (name !== undefined) {
      updateData["team.$[member].name"] = name.trim();
    }
    if (role !== undefined) {
      updateData["team.$[member].role"] = role.trim();
    }
    if (image !== undefined) {
      updateData["team.$[member].image"] = image.trim();
    }
    if (department !== undefined) {
      updateData["team.$[member].department"] = department.trim();
    }

    // Update member using MongoDB update with arrayFilters
    const result = await Team.updateOne(
      {},
      { $set: updateData },
      { arrayFilters: arrayFilters }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }

    // Get updated member using aggregation
    const updatedMemberResult = await Team.aggregate([
      { $match: {} },
      {
        $project: {
          member: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$team",
                  as: "member",
                  cond: { $eq: ["$$member._id", new mongoose.Types.ObjectId(id)] }
                }
              },
              0
            ]
          }
        }
      }
    ]);

    const updatedMember = updatedMemberResult[0]?.member;

    res.status(200).json({
      success: true,
      message: "Team member updated successfully",
      data: updatedMember,
    });
  } catch (error: any) {
    console.error("Error updating member:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not update member.",
      error: error.message,
    });
  }
};

export const deleteMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
      return;
    }

    // Check if member exists using aggregation
    const memberExists = await Team.aggregate([
      { $match: {} },
      {
        $project: {
          memberExists: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$team",
                    as: "member",
                    cond: { $eq: ["$$member._id", new mongoose.Types.ObjectId(id)] }
                  }
                }
              },
              0
            ]
          }
        }
      }
    ]);

    if (!memberExists || memberExists.length === 0 || !memberExists[0].memberExists) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      });
      return;
    }

    // Remove member from array using $pull
    const result = await Team.updateOne(
      {},
      { $pull: { team: { _id: new mongoose.Types.ObjectId(id) } } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Team member deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting member:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not delete member.",
      error: error.message,
    });
  }
};
