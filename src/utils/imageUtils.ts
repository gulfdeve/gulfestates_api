/**
 * Utility functions for handling remote images
 */

// Enhanced URL validation that works with Unsplash and other CDNs
export const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    // Basic URL validation
    const parsedUrl = new URL(url);
    
    // Check protocol
    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return false;
    }
    
    // Check domain and path
    const validDomains = [
      'unsplash.com',
      'images.unsplash.com',
      'cloudinary.com',
      'res.cloudinary.com',
      'example.com', // Add your domains
      'localhost' // For development
    ];
    
    const isValidDomain = validDomains.some(domain => 
      parsedUrl.hostname.includes(domain)
    );
    
    if (!isValidDomain) {
      return false;
    }
    
    // Check file extension or image indicators
    const path = parsedUrl.pathname.toLowerCase();
    const hasImageExtension = /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(path);
    const hasImageIndicator = path.includes('/photo-') || path.includes('/images/');
    
    return hasImageExtension || hasImageIndicator;
    
  } catch (error) {
    // If URL parsing fails, it's invalid
    return false;
  }
};

// More lenient validation for development
export const isValidImageUrlLenient = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    new URL(url);
    return url.startsWith('http') && (url.includes('.') || url.includes('localhost'));
  } catch {
    return false;
  }
};

// Generate optimized image URL for Unsplash
export const getOptimizedImageUrl = (url: string, width: number = 800, quality: number = 80): string => {
  if (!url) return getFallbackImage('default');
  
  if (url.includes('unsplash.com')) {
    // For Unsplash, we can optimize by adding parameters
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}&q=${quality}&fit=crop&crop=entropy`;
  }
  
  if (url.includes('cloudinary.com')) {
    // Cloudinary optimization
    return url.replace(/upload\/(.*)\//, `upload/w_${width},q_${quality},c_fill/$1/`);
  }
  
  return url;
};

// Fallback images for different categories
export const getFallbackImage = (type: string = 'default'): string => {
  const fallbacks = {
    apartment: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    villa: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    townhouse: 'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=800&q=80',
    penthouse: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    duplex: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    default: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80'
  };

  const key = type.toLowerCase();
  return fallbacks[key as keyof typeof fallbacks] || fallbacks.default;
};

// Validate multiple images
export const validateImages = (images: string[]): string[] => {
  if (!Array.isArray(images)) return [getFallbackImage()];
  
  const validImages = images.filter(img => isValidImageUrl(img));
  return validImages.length > 0 ? validImages : [getFallbackImage()];
};