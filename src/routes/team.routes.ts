import express from "express";
import {
  getTeam,
  updateTeam,
} from "../controllers/team.controller.js";
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} from "../controllers/members.controller.js";
import { protect, restrictToSuperAdmin } from "../middleware/auth.middleware.js";
import { generalApiRateLimiter } from "../middleware/rateLimiter.middleware.js";
import { uploadTeamImage } from "../utils/multerCloudinary.js";

const router = express.Router();

// Middleware to validate image uploads (only allow ownerImage and teamslider[*]image fields)
const validateImageUploads = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  
  if (files) {
    for (const fieldname in files) {
      const fileArray = files[fieldname];
      if (Array.isArray(fileArray)) {
        for (const file of fileArray) {
          const isValidField = 
            fieldname === 'ownerImage' || 
            /^teamslider\[\d+\]image$/.test(fieldname);
          
          if (!isValidField) {
            return res.status(400).json({
              success: false,
              message: `Invalid field name: ${fieldname}. Only 'ownerImage' and 'teamslider[*]image' are allowed.`
            });
          }
          
          const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
          if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
              success: false,
              message: `Invalid file type for ${fieldname}. Only image files are allowed.`
            });
          }
        }
      }
    }
  }
  
  next();
};

// Team Data Routes
router.get("/", generalApiRateLimiter, getTeam);
router.put("/", protect, restrictToSuperAdmin, uploadTeamImage.any(), validateImageUploads, updateTeam);

// Members Routes (nested)
router.get("/members", generalApiRateLimiter, getAllMembers);
router.get("/members/:id", generalApiRateLimiter, getMemberById);
router.post("/members", protect, restrictToSuperAdmin, uploadTeamImage.single('image'), createMember);
router.put("/members/:id", protect, restrictToSuperAdmin, uploadTeamImage.single('image'), updateMember);
router.delete("/members/:id", protect, restrictToSuperAdmin, deleteMember);

export default router;

