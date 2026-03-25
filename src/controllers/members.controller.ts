import { Request, Response } from "express";
import Team from "../models/team.model.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { downloadAndUploadImage } from "../utils/imageDownloader.js";

// Helper function to process image (file, URL, or base64)
const processImage = async (imageData: any, folder: string = 'team/members'): Promise<string> => {
  try {
    if (!imageData || imageData === "" || (typeof imageData === 'string' && imageData.trim() === "")) {
      return "";
    }

    // Already a Cloudinary URL
    if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
      return imageData;
    }

    // File path from multer-storage-cloudinary: file.path IS the Cloudinary URL
    // (multer-storage-cloudinary sets file.path to the secure_url)

    // External URL (not Cloudinary) — download and re-upload
    if (typeof imageData === 'string' && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
      return await downloadAndUploadImage(imageData, folder);
    }

    // Base64 data URI — upload directly without writing to disk
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      const result = await cloudinary.uploader.upload(imageData, {
        folder: `gulf-estates/${folder}`,
        resource_type: 'image',
      });
      return result.secure_url;
    }

    return imageData || "";
  } catch (error: any) {
    console.error('Error processing image:', error);
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
        image = files.image[0].path; // already Cloudinary URL via multer-storage-cloudinary
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
