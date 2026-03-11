import { Request, Response, NextFunction } from 'express';

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get origin header (for cross-origin requests) or extract from referer (for same-origin requests)
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  
  // List of allowed origins
  const allowedOrigins = [
    'https://gulf.smbdigitalzone.com',
    'https://admin.gulf.smbdigitalzone.com',
    'https://backend.gulf.smbdigitalzone.com',
    'https://gulfestates.ae',
    'https://www.gulfestates.ae',
    'https://backend.gulfestates.ae',
    'https://admin.gulfestates.ae',
  ];

  // Add localhost in development
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }

  // Extract origin from headers
  let originToCheck: string | null = null;

  // Prefer origin header (browsers send this for cross-origin requests)
  if (originHeader) {
    originToCheck = originHeader;
  } 
  // Fallback to referer header (browsers send this for same-origin requests)
  else if (refererHeader) {
    try {
      const url = new URL(refererHeader);
      originToCheck = `${url.protocol}//${url.host}`;
    } catch (e) {
      // Invalid referer URL format - will be handled below
    }
  }

  if (!originToCheck) {
    return next();
  }

  // Check if origin matches any allowed origin (exact match for security)
  const isAllowed = allowedOrigins.includes(originToCheck!);

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Request origin not allowed',
    });
  }

  next();
};


