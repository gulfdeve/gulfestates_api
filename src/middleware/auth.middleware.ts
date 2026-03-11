import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload as DefaultJwtPayload } from 'jsonwebtoken';
import Admin, { IAdmin } from '../models/admin.model.js';

/**
 * Custom JWT payload type
 */
interface JwtPayload extends DefaultJwtPayload {
  id: string;
}

/**
 * Extend Express Request to include admin (IAdmin)
 */
declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
      user?: IAdmin; // Keep for backward compatibility
    }
  }
}

/**
 * Protect middleware
 * Verifies JWT token and attaches admin to req.admin and req.user
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // 1️⃣ Get token from Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 2️⃣ Reject if no token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Token missing.',
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET as string;
    if (!JWT_SECRET) {
      console.error("❌ JWT_SECRET is not defined in .env file");
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact support.',
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // 4️⃣ Fetch admin
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found.',
      });
    }

    // 5️⃣ Attach admin
    req.admin = admin;
    req.user = admin; // Keep for backward compatibility
    next();
  } catch (error: any) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid or expired token.',
    });
  }
};

/**
 * Restrict to admin roles (admin or superadmin)
 * Note: If a user has access to create (POST) and view (GET) a resource,
 * they automatically have access to edit (PUT) that resource.
 * This middleware is used for both create and update operations.
 */
export const restrictToAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please login.',
    });
  }

  const role = req.admin.role || 'user';
  // Allow both 'admin' and 'superadmin' roles
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }

  next();
};


export const restrictToCustomerManager = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please login.',
    });
  }

  const role = req.admin.role || 'user';
  // Superadmin can access customer-manager routes
  if (role !== 'customer-manager' && role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Customer manager privileges required.',
    });
  }

  next();
};

export const restrictToAdminOrCustomerManager = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please login.',
    });
  }

  const role = req.admin.role || 'user';
  // Superadmin can access all routes
  if (role !== 'admin' && role !== 'customer-manager' && role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or customer manager privileges required.',
    });
  }

  next();
};

/**
 * Restrict to superadmin only
 */
export const restrictToSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please login.',
    });
  }

  const role = req.admin.role || 'user';
  if (role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Superadmin privileges required.',
    });
  }

  next();
};
