import express from 'express';
import { uploadImage, uploadMultiple, uploadVideo } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadImage as uploadImageMiddleware, uploadVideo as uploadVideoMiddleware } from '../utils/multerCloudinary.js';

const router = express.Router();

router.post('/image', protect, uploadImageMiddleware.single('image'), uploadImage);
router.post('/multiple', protect, uploadImageMiddleware.array('images', 10), uploadMultiple);
router.post('/video', protect, uploadVideoMiddleware.single('video'), uploadVideo);

export default router;