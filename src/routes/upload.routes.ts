import express from 'express';
import { uploadImage, uploadMultiple, uploadVideo } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload, uploadVideoMiddleware } from '../middleware/upload.middleware.js';

const router = express.Router();

router.post('/image', protect, upload.single('image'), uploadImage);
router.post('/multiple', protect, upload.array('images', 10), uploadMultiple);
router.post('/video', protect, uploadVideoMiddleware.single('video'), uploadVideo);

export default router;