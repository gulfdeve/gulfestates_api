import multer from 'multer';
import path from 'path';
import { isDangerousFile, isAllowedImage, isAllowedVideo } from '../utils/fileSecurity.util.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Block dangerous executable files first
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked.`));
  }

  // Only allow image files
  if (isAllowedImage(file.originalname, file.mimetype)) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
};

const videoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isDangerousFile(file.originalname)) {
    return cb(new Error(`File type ${path.extname(file.originalname)} is not allowed. Executable and script files are blocked.`));
  }
  if (isAllowedVideo(file.originalname, file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only video files (MP4, WebM, OGG, QuickTime) are allowed!'));
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

export const uploadVideoMiddleware = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: videoFileFilter
});