import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";
import Team from "../models/team.model.js";
import cloudinary from "../config/cloudinary.js";
import { downloadAndUploadImage } from "../utils/imageDownloader.js";
import fs from "fs";

// Helper function to verify token and check if user is authenticated admin
const verifyAdminToken = async (req: Request): Promise<boolean> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return false;
    }

    const JWT_SECRET = process.env.JWT_SECRET as string;
    if (!JWT_SECRET) {
      return false;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const admin = await Admin.findById(decoded.id).select('-password role').lean();

    // Return true only if admin exists and is superadmin
    return !!admin && admin.role === "superadmin";
  } catch (error) {
    return false;
  }
};

// Helper function to upload image file to Cloudinary
const uploadImageToCloudinary = async (filePath: string, folder: string = 'team/images'): Promise<string> => {
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
const processImage = async (imageData: any, folder: string = 'team/images'): Promise<string> => {
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

export const getTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify if request is from authenticated admin
    const isAdmin = await verifyAdminToken(req);

    const team = await Team.findOne().select("-team");

    if (!team) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }

    // Convert to object for manipulation
    const teamObj = team.toObject ? team.toObject() : team;

    // If admin, return full multilingual data; otherwise return localized
    if (isAdmin) {
      // Return full multilingual structure for admin users
      const fullTeam = {
        ...teamObj,
        owner: {
          ...teamObj.owner,
          name: teamObj.owner?.name || "", // Single string (NOT multilingual)
          role: teamObj.owner?.role || "", // Single string (NOT multilingual)
          description: teamObj.owner?.description || { en: "", fr: "", es: "" }, // Full multilingual object
          image: teamObj.owner?.image || "",
        },
        title: teamObj.title || { en: "", fr: "", es: "" }, // Full multilingual object
        description: teamObj.description || { en: "", fr: "", es: "" }, // Full multilingual object
        teamslider: teamObj.teamslider || [],
      };

      res.status(200).json({
        success: true,
        data: fullTeam,
      });
    } else {
      // Localize the team data based on locale for public access
      const localizedTeam = {
        ...teamObj,
        owner: {
          ...teamObj?.owner || { name: "", role: "", description: { en: "", fr: "", es: "" }, image: "" },
          name: teamObj.owner?.name || "", // Single string (NOT multilingual)
          role: teamObj.owner?.role || "", // Single string (NOT multilingual)
          description: teamObj?.owner?.description || { en: "", fr: "", es: "" }, // Multilingual
          image: teamObj.owner?.image || "",
        },
        title: teamObj?.title || { en: "", fr: "", es: "" },
        description: teamObj?.description || { en: "", fr: "", es: "" },
        teamslider: teamObj?.teamslider || [],
        // Exclude team array from response (members are managed separately)
      };

      res.status(200).json({
        success: true,
        data: localizedTeam,
      });
    }
  } catch (error: any) {
    console.error("Error fetching team:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not fetch team data.",
      error: error.message,
    });
  }
};

// export const createTeam = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // Check if team already exists
//     const existingTeam = await Team.findOne();
//     if (existingTeam) {
//       res.status(400).json({
//         success: false,
//         message: "Team data already exists. Use PUT to update.",
//       });
//       return;
//     }

//     let { owner, title, description, teamslider } = req.body;

//     // Parse JSON strings if needed
//     if (typeof owner === 'string') {
//       try {
//         owner = JSON.parse(owner);
//       } catch (e) {
//         // Keep as is if parsing fails
//       }
//     }
//     if (typeof teamslider === 'string') {
//       try {
//         teamslider = JSON.parse(teamslider);
//       } catch (e) {
//         // Keep as is if parsing fails
//       }
//     }

//     // Handle file uploads (multer)
//     const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    
//     // Process owner image
//     if (owner) {
//       // Check if image comes from file upload
//       if (files?.ownerImage && files.ownerImage[0]) {
//         owner.image = await uploadImageToCloudinary(files.ownerImage[0].path, 'team/owner');
//       } else if (owner.image) {
//         // Process image URL or base64
//         owner.image = await processImage(owner.image, 'team/owner');
//       }
//     }

//     // Process teamslider images
//     if (teamslider && Array.isArray(teamslider)) {
//       for (let i = 0; i < teamslider.length; i++) {
//         const item = teamslider[i];
//         if (item.image) {
//           // Check if image comes from file upload (field name like 'teamslider[0]image')
//           const fileKey = `teamslider[${i}]image`;
//           if (files && files[fileKey] && files[fileKey][0]) {
//             item.image = await uploadImageToCloudinary(files[fileKey][0].path, 'team/slider');
//           } else {
//             // Process image URL or base64
//             item.image = await processImage(item.image, 'team/slider');
//           }
//         }
//       }
//     }

//     // Validate required fields
//     if (!owner || !title || !description) {
//       res.status(400).json({
//         success: false,
//         message: "Owner, title, and description are required",
//       });
//       return;
//     }

//     // Validate owner structure
//     if (
//       !owner.name ||
//       !owner.role ||
//       !owner.description ||
//       !owner.image ||
//       typeof owner.name !== 'string' ||
//       typeof owner.role !== 'string' ||
//       !owner.description.en ||
//       !owner.description.fr ||
//       !owner.description.es
//     ) {
//       res.status(400).json({
//         success: false,
//         message:
//           "Owner must have name (string), role (string), description (with en, fr, es), and image",
//       });
//       return;
//     }

//     // Validate title and description structure
//     if (!title.en || !title.fr || !title.es) {
//       res.status(400).json({
//         success: false,
//         message: "Title must have en, fr, and es fields",
//       });
//       return;
//     }

//     if (!description.en || !description.fr || !description.es) {
//       res.status(400).json({
//         success: false,
//         message: "Description must have en, fr, and es fields",
//       });
//       return;
//     }

//     // Initialize team array as empty (members managed separately)
//     const newTeam = await Team.create({
//       owner,
//       title,
//       description,
//       teamslider: teamslider || [],
//       team: [], // Initialize as empty array
//     });

//     res.status(201).json({
//       success: true,
//       message: "Team data created successfully",
//       data: newTeam,
//     });
//   } catch (error: any) {
//     console.error("Error creating team:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error. Could not create team data.",
//       error: error.message,
//     });
//   }
// };

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    let { owner, title, description, teamslider } = req.body;

    // Parse JSON strings if needed
    if (typeof owner === 'string') {
      try {
        owner = JSON.parse(owner);
      } catch (e) {
        // Keep as is if parsing fails
      }
    }
    if (typeof teamslider === 'string') {
      try {
        teamslider = JSON.parse(teamslider);
      } catch (e) {
        // Keep as is if parsing fails
      }
    }

    // Find existing team
    const existingTeam = await Team.findOne();

    if (!existingTeam) {
      res.status(404).json({
        success: false,
        message: "Team data not found. Use POST to create.",
      });
      return;
    }

    // Handle file uploads (multer)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Build update object with only provided fields
    // Do NOT allow updating team array through this endpoint
    const updateData: any = {};

    if (owner) {
      // Process owner image
      if (files?.ownerImage && files.ownerImage[0]) {
        owner.image = await uploadImageToCloudinary(files.ownerImage[0].path, 'team/owner');
      } else if (owner.image && owner.image !== existingTeam.owner?.image) {
        // Only process if image has changed
        owner.image = await processImage(owner.image, 'team/owner');
      }
      updateData.owner = owner;
    }
    
    if (title) {
      updateData.title = title;
    }

    if (description) {
      updateData.description = description;
    }

    if (teamslider !== undefined) {
      // Process teamslider images
      if (Array.isArray(teamslider)) {
        for (let i = 0; i < teamslider.length; i++) {
          const item = teamslider[i];
          if (item.image) {
            // Check if image comes from file upload
            const fileKey = `teamslider[${i}]image`;
            if (files && files[fileKey] && files[fileKey][0]) {
              item.image = await uploadImageToCloudinary(files[fileKey][0].path, 'team/slider');
            } else if (item.image !== existingTeam.teamslider?.[i]?.image) {
              // Only process if image has changed
              item.image = await processImage(item.image, 'team/slider');
            }
          }
        }
      }
      updateData.teamslider = teamslider;
    }

    // Explicitly prevent team array updates
    if (req.body.team !== undefined) {
      res.status(400).json({
        success: false,
        message: "Cannot update team members array through this endpoint. Use /api/team/members endpoints.",
      });
      return;
    }

    // Update team data
    const updatedTeam = await Team.findByIdAndUpdate(
      existingTeam._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTeam) {
      res.status(404).json({
        success: false,
        message: "Team data not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Team data updated successfully",
      data: updatedTeam,
    });
  } catch (error: any) {
    console.error("Error updating team:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not update team data.",
      error: error.message,
    });
  }
};
