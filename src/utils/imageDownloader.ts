import cloudinary from '../config/cloudinary.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Download image from URL and upload to Cloudinary
 * @param imageUrl - The URL of the image to download
 * @param folder - Cloudinary folder path (default: 'offplans/images')
 * @returns Promise<string> - Cloudinary secure URL
 */
export const downloadAndUploadImage = async (
  imageUrl: string,
  folder: string = 'offplans/images'
): Promise<string> => {
  try {
    // Validate URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Invalid image URL');
    }

    // Skip if already a Cloudinary URL or data URL
    if (imageUrl.includes('cloudinary.com') || imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    // Download the image using Node.js fetch
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const tempFilePath = path.join(tempDir, `${uniqueId}${fileExtension}`);

    // Convert response to buffer and save to file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
      folder: `gulf-estates/${folder}`,
      resource_type: 'auto',
      // No transformation - preserve original image without cropping
    });

    // Delete temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return uploadResult.secure_url;
  } catch (error: any) {
    console.error(`Error downloading/uploading image ${imageUrl}:`, error.message);
    // Return original URL if upload fails
    return imageUrl;
  }
};

/**
 * Download and upload multiple images
 * @param imageUrls - Array of image URLs
 * @param folder - Cloudinary folder path
 * @returns Promise<string[]> - Array of Cloudinary secure URLs
 */
export const downloadAndUploadMultipleImages = async (
  imageUrls: string[],
  folder: string = 'offplans/images'
): Promise<string[]> => {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return [];
  }

  // Process images in batches to avoid overwhelming the system
  const batchSize = 5;
  const results: string[] = [];

  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(url => downloadAndUploadImage(url, folder))
    );
    results.push(...batchResults);
  }

  return results;
};

