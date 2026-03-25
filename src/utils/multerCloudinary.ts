import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import { isDangerousFile, isAllowedImage, isAllowedPDF, isAllowedResumeOrPortfolio, isAllowedVideo } from './fileSecurity.util.js';
import path from 'path';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ✅ Image Storage
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gulfestate/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }],
  } as any,
});

// ✅ Video Storage
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gulfestate/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv'],
  } as any,
});

// ✅ PDF/Document Storage (brochures, etc.)
const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gulfestate/job-applications',
    resource_type: 'raw',
    allowed_formats: ['pdf'],
  } as any,
});

// ✅ Property files — images go to properties/images, brochures (PDF) go to properties/brochures
const propertyStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req: any, file: Express.Multer.File) => {
    if (file.fieldname === 'brochure') {
      return {
        folder: 'properties/brochures',
        resource_type: 'raw',
        allowed_formats: ['pdf'],
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
        type: 'upload',
      };
    }
    return {
      folder: 'properties/images',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    };
  },
} as any);

// ✅ OffPlan files — images go to offplans/images, brochures (PDF) go to offplans/brochures
const offPlanStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req: any, file: Express.Multer.File) => {
    if (file.fieldname === 'brochure') {
      return {
        folder: 'offplans/brochures',
        resource_type: 'raw',
        allowed_formats: ['pdf'],
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
        type: 'upload',
      };
    }
    return {
      folder: 'offplans/images',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    };
  },
} as any);

// ✅ Team images (owner, teamslider, members)
const teamImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gulf-estates/team',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  } as any,
});

// ✅ Email marketing campaign images
const emailMarketingStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'email-marketing/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  } as any,
});

// ✅ Job Resume/Portfolio Storage - PDF and DOCX, uploads to Cloudinary first (fileFilter restricts types)
const jobResumeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gulfestate/job-applications',
    resource_type: 'raw',
    // For raw uploads, specify the actual allowed extensions (Cloudinary will still store as raw)
    // and rely on fileFilter for the authoritative security gate.
    allowed_formats: ['pdf', 'docx'],
  } as any,
});

// File filter for images - blocks executable files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked for security.`));
  }

  // Only allow image files
  if (isAllowedImage(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    return cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
};

// File filter for videos - blocks executable files
const videoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked for security.`));
  }

  // Only allow video files
  if (isAllowedVideo(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    return cb(new Error('Only video files (MP4, MOV, AVI, MKV, WEBM) are allowed!'));
  }
};

// File filter for PDFs - blocks executable files (used for brochures)
const pdfFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked for security.`));
  }
  if (isAllowedPDF(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    return cb(new Error('Only PDF files are allowed!'));
  }
};

// File filter for job resumes/portfolios - PDF and DOCX only, blocks executables
const jobResumeFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked for security.`));
  }
  if (isAllowedResumeOrPortfolio(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    return cb(new Error('Only PDF and DOCX files are allowed!'));
  }
};

// File filter for property/offplan routes — images OR PDF brochure based on fieldname
const propertyFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked.`));
  }
  if (file.fieldname === 'brochure') {
    if (isAllowedPDF(file.originalname, file.mimetype)) return cb(null, true);
    return cb(new Error('Only PDF files are allowed for brochures!'));
  }
  if (isAllowedImage(file.originalname, file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files (JPEG, JPG, PNG, WEBP, AVIF) are allowed!'));
};

// ✅ Multer upload instances with security filters
export const uploadImage = multer({ 
  storage: imageStorage,
  fileFilter: imageFileFilter
});

export const uploadVideo = multer({ 
  storage: videoStorage,
  fileFilter: videoFileFilter
});

export const uploadPDF = multer({ 
  storage: pdfStorage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
  },
  fileFilter: pdfFileFilter
});

/** Job application resume/portfolio: PDF and DOCX only, uploads to Cloudinary then stores URL in DB */
export const uploadJobResume = multer({ 
  storage: jobResumeStorage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
  },
  fileFilter: jobResumeFileFilter
});

/** Property images (JPEG/PNG/WEBP/AVIF) + PDF brochure — streams directly to Cloudinary */
export const uploadPropertyFiles = multer({
  storage: propertyStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: propertyFileFilter,
});

/** OffPlan images (JPEG/PNG/WEBP/AVIF) + PDF brochure — streams directly to Cloudinary */
export const uploadOffPlanFiles = multer({
  storage: offPlanStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: propertyFileFilter,
});

/** Team / member images — streams directly to Cloudinary */
export const uploadTeamImage = multer({
  storage: teamImageStorage,
  fileFilter: imageFileFilter,
});

/** Email marketing campaign banner image — streams directly to Cloudinary */
export const uploadEmailMarketingImage = multer({
  storage: emailMarketingStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});
