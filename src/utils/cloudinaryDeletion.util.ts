import cloudinary from "../config/cloudinary.js";

// Helper function to extract public_id from Cloudinary URL
export const extractPublicId = (url: string): string | null => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    // Match: /upload/v1234567890/folder/file.ext or /upload/folder/file.ext
    const match = url.match(/\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/);
    if (match) return match[1];
    const match2 = url.match(/\/upload\/(.+?)(?:\.[^.]+)?$/);
    if (match2) return match2[1];
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

// Helper function to delete Cloudinary asset
export const deleteCloudinaryAsset = async (publicId: string, resourceType: 'image' | 'raw' = 'image') => {
  try {
    if (!publicId) return;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    console.log(`🗑️ Deleted ${resourceType} from Cloudinary: ${publicId}`, result.result);
  } catch (error: any) {
    console.error(`❌ Error deleting ${resourceType} from Cloudinary (${publicId}):`, error.message);
  }
};

// Helper function to delete all Cloudinary assets for a property
export const deletePropertyCloudinaryAssets = async (property: any) => {
  try {
    const deletePromises: Promise<void>[] = [];

    // Delete main image
    if (property.image && typeof property.image === 'string') {
      const imagePublicId = extractPublicId(property.image);
      if (imagePublicId) {
        deletePromises.push(deleteCloudinaryAsset(imagePublicId, 'image'));
      }
    }

    // Delete additional images
    if (property.images && Array.isArray(property.images)) {
      property.images.forEach((imageUrl: string) => {
        if (typeof imageUrl === 'string') {
          const imagePublicId = extractPublicId(imageUrl);
          if (imagePublicId) {
            deletePromises.push(deleteCloudinaryAsset(imagePublicId, 'image'));
          }
        }
      });
    }

    // Delete brochure PDF
    if (property.brochure && typeof property.brochure === 'string') {
      const brochurePublicId = extractPublicId(property.brochure);
      if (brochurePublicId) {
        deletePromises.push(deleteCloudinaryAsset(brochurePublicId, 'raw'));
      }
    }

    // Delete QR image
    if (property.qrImage && typeof property.qrImage === 'string') {
      const qrPublicId = extractPublicId(property.qrImage);
      if (qrPublicId) {
        deletePromises.push(deleteCloudinaryAsset(qrPublicId, 'image'));
      }
    }

    // Delete all assets in parallel
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${deletePromises.length} Cloudinary assets for property ${property._id}`);
  } catch (error: any) {
    console.error(`❌ Error deleting Cloudinary assets for property:`, error.message);
  }
};

// Helper function to delete all Cloudinary assets for an off-plan
export const deleteOffPlanCloudinaryAssets = async (offplan: any) => {
  try {
    const deletePromises: Promise<void>[] = [];

    // Delete main image
    if (offplan.image && typeof offplan.image === 'string') {
      const imagePublicId = extractPublicId(offplan.image);
      if (imagePublicId) {
        deletePromises.push(deleteCloudinaryAsset(imagePublicId, 'image'));
      }
    }

    // Delete additional images
    if (offplan.images && Array.isArray(offplan.images)) {
      offplan.images.forEach((imageUrl: string) => {
        if (typeof imageUrl === 'string') {
          const imagePublicId = extractPublicId(imageUrl);
          if (imagePublicId) {
            deletePromises.push(deleteCloudinaryAsset(imagePublicId, 'image'));
          }
        }
      });
    }

    // Delete brochure PDF
    if (offplan.brochure && typeof offplan.brochure === 'string') {
      const brochurePublicId = extractPublicId(offplan.brochure);
      if (brochurePublicId) {
        deletePromises.push(deleteCloudinaryAsset(brochurePublicId, 'raw'));
      }
    }

    // Delete QR image
    if (offplan.qrImage && typeof offplan.qrImage === 'string') {
      const qrPublicId = extractPublicId(offplan.qrImage);
      if (qrPublicId) {
        deletePromises.push(deleteCloudinaryAsset(qrPublicId, 'image'));
      }
    }

    // Delete nearby landmarks images
    if (offplan.nearbyLandmarks && Array.isArray(offplan.nearbyLandmarks)) {
      offplan.nearbyLandmarks.forEach((landmark: any) => {
        if (landmark?.image && typeof landmark.image === 'string') {
          const landmarkPublicId = extractPublicId(landmark.image);
          if (landmarkPublicId) {
            deletePromises.push(deleteCloudinaryAsset(landmarkPublicId, 'image'));
          }
        }
      });
    }

    // Delete floor plans images
    if (offplan.floorPlans && Array.isArray(offplan.floorPlans)) {
      offplan.floorPlans.forEach((floorPlan: any) => {
        if (floorPlan?.image && typeof floorPlan.image === 'string') {
          const floorPlanPublicId = extractPublicId(floorPlan.image);
          if (floorPlanPublicId) {
            deletePromises.push(deleteCloudinaryAsset(floorPlanPublicId, 'image'));
          }
        }
      });
    }

    // Delete all assets in parallel
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${deletePromises.length} Cloudinary assets for off-plan ${offplan._id}`);
  } catch (error: any) {
    console.error(`❌ Error deleting Cloudinary assets for off-plan:`, error.message);
  }
};
