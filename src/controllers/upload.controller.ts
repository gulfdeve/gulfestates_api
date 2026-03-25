import { Request, Response } from 'express';

// 🟩 Upload Single Image
export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded',
      });
    }

    // With multer-storage-cloudinary, file.path is the Cloudinary URL and file.filename is the public_id
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (error: any) {
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

    const uploadedImages = files.map(file => ({
      url: file.path,
      public_id: file.filename,
    }));

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images: uploadedImages },
    });
  } catch (error: any) {
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

    res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: req.file.path,
        public_id: req.file.filename,
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

    const uploadedVideos = files.map(file => ({
      url: file.path,
      public_id: file.filename,
    }));

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

