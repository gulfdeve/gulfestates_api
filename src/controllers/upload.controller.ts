import { Request, Response } from 'express';
import fs from 'fs';
import cloudinary from '../config/cloudinary.js';

// 🟩 Upload Single Image
export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded',
      });
    }

    // Upload directly to Cloudinary without any resizing or cropping
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'gulf-estate/images',
      resource_type: 'image',
      // No transformation - preserve original image without cropping
    });

    // Delete local file after upload
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      },
    });
  } catch (error: any) {
    // Delete local file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message,
    });
  }
};

// 🟩 Upload Multiple Images
export const uploadMultiple = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded',
      });
    }

    const uploadedImages: Array<{ url: string; public_id: string }> = [];

    for (const file of files) {
      // Upload directly to Cloudinary without any resizing or cropping
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'gulf-estate/images',
        resource_type: 'image',
        // No transformation - preserve original image without cropping
      });

      // Delete local file after upload
      fs.unlinkSync(file.path);

      uploadedImages.push({
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images: uploadedImages },
    });
  } catch (error: any) {
    // Delete local files on error
    const files = req.files as Express.Multer.File[];
    if (files) {
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading images',
      error: error.message,
    });
  }
};

// 🟩 Upload Single Video
export const uploadVideo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video uploaded',
      });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'gulf-estate/videos',
      resource_type: 'video',
    });

    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error uploading video',
      error: error.message,
    });
  }
};

// 🟩 Upload Multiple Videos
export const uploadMultipleVideos = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No videos uploaded',
      });
    }

    const uploadedVideos: Array<{ url: string; public_id: string }> = [];

    for (const file of files) {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'gulf-estate/videos',
        resource_type: 'video',
      });

      fs.unlinkSync(file.path);

      uploadedVideos.push({
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Videos uploaded successfully',
      data: { videos: uploadedVideos },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error uploading videos',
      error: error.message,
    });
  }
};
