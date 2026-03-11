import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = async (filePath: string, folder = 'properties') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `gulf-estates/${folder}`,
      resource_type: 'auto',
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    });

    // Delete local file after upload
    fs.unlinkSync(filePath);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      thumbnail: cloudinary.url(result.public_id, {
        width: 300,
        height: 200,
        crop: 'fill'
      })
    };
  } catch (error) {
    // Delete local file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

export const deleteFromCloudinary = async (publicId: string) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

// Extract public_id from Cloudinary URL
export const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
    const match = url.match(/\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/);
    if (match) {
      return match[1];
    }
    // Try alternative format without version
    const match2 = url.match(/\/upload\/(.+?)(?:\.[^.]+)?$/);
    if (match2) {
      return match2[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
};

// Make a Cloudinary resource public
export const makeCloudinaryResourcePublic = async (publicId: string, resourceType: 'image' | 'raw' | 'video' = 'raw') => {
  try {
    // Use explicit to update the resource with public access
    const result = await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      resource_type: resourceType,
      access_mode: 'public',
      overwrite: false
    });
    console.log(`✅ Made resource public: ${publicId}`);
    // Return the secure_url from the result
    return result.secure_url || cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true
    });
  } catch (error: any) {
    // If explicit fails, try to generate the URL anyway (it might already be accessible)
    console.warn(`⚠️  Could not update access mode for ${publicId}, trying to generate URL anyway:`, error.message);
    // Generate the URL - if it's already public, this will work
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true
    });
  }
};

// Fix a Cloudinary URL by making it public
export const fixCloudinaryUrl = async (url: string, resourceType: 'image' | 'raw' | 'video' = 'raw'): Promise<string> => {
  try {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      throw new Error('Could not extract public_id from URL');
    }
    const newUrl = await makeCloudinaryResourcePublic(publicId, resourceType);
    return newUrl;
  } catch (error: any) {
    console.error('Error fixing Cloudinary URL:', error);
    throw error;
  }
};