import express from 'express';
import multer from 'multer';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getSimilarProperties,
  getFeaturedProperties,
  bulkCreateProperties,
  getPropertyCounts,
} from '../controllers/property.controller.js';
import { protect, restrictToAdmin } from '../middleware/auth.middleware.js';
import { propertyRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

import { isDangerousFile, isAllowedImage, isAllowedPDF } from '../utils/fileSecurity.util.js';
import path from 'path';

// Configure multer for multiple file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked.`));
  }

  // Allow images for 'images', 'image', and 'qrImage' fields
  if (file.fieldname === 'images' || file.fieldname === 'image' || file.fieldname === 'qrImage') {
    if (isAllowedImage(file.originalname, file.mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Only image files (JPEG, JPG, PNG, WEBP, AVIF) are allowed!'));
    }
  }

  // Allow PDF for 'brochure' field (also used for career applications)
  if (file.fieldname === 'brochure') {
    if (isAllowedPDF(file.originalname, file.mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Only PDF files are allowed'));
    }
  }

  cb(new Error('Invalid file field name'));
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit (for PDF brochures; images have separate validation)
  },
  fileFilter: fileFilter
});

// Public routes - Rate limited: 100 requests per hour per IP (admins excluded)
router.get('/', propertyRateLimiter, getAllProperties);
router.get('/featured', propertyRateLimiter, getFeaturedProperties);
router.get('/counts', propertyRateLimiter, getPropertyCounts);
router.get('/:id', propertyRateLimiter, getPropertyById);
router.get('/:id/similar', propertyRateLimiter, getSimilarProperties);

// Property routes with file uploads - REMOVED locationImage field
// Using upload.any() to allow both file uploads and URL strings for brochure/qrImage fields
// Accessible to both 'admin' and 'superadmin' roles
// Note: If user has access to create (POST) and view (GET), they automatically have access to edit (PUT)
router.post('/', protect, restrictToAdmin, upload.any(), createProperty);

router.put('/:id', protect, restrictToAdmin, upload.any(), updateProperty);

// REMOVED location update route

// Other routes
router.post('/bulk', protect, restrictToAdmin, bulkCreateProperties);
router.delete('/:id', protect, restrictToAdmin, deleteProperty);

export default router;