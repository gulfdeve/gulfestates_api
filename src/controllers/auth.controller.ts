import { Request, Response } from 'express';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Admin, { IAdmin } from '../models/admin.model.js';
import { sendEmail } from '../utils/email.util.js';

// ✅ Load environment variables
dotenv.config();

// ✅ Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
      user?: IAdmin; // Keep for backward compatibility
    }
  }
}

// ✅ Generate JWT Token
const generateToken = (id: string): string => {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
    const expiresInEnv = process.env.JWT_EXPIRE || '1d'; // 1 day expiration

  // jwt.sign accepts either a number (seconds) or string like "30d"
  return jwt.sign({ id }, secret, { expiresIn: expiresInEnv as any });
};

// ✅ REGISTER ADMIN
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, confirmPassword, phone, avatar } = req.body;

    // Validate confirm password
    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match',
      });
      return;
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      res.status(400).json({
        success: false,
        message: 'Admin already exists with this email',
      });
      return;
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      phone,
      avatar,
    });

    const token = generateToken(admin._id.toString());

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar,
        },
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error registering admin',
      error: error.message,
    });
  }
};

// ✅ LOGIN (General login - can be used for admin)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
      return;
    }

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin._id.toString());

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar,
        },
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message,
    });
  }
};

// ✅ GET LOGGED-IN ADMIN
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.admin?.id && !req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: No admin found in request',
      });
      return;
    }

    const adminId = req.admin?.id || req.user?.id;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar,
          role: admin.role || 'user',
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin profile',
      error: error.message,
    });
  }
};

// ✅ FORGOT PASSWORD
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      // Return success even if email doesn't exist to prevent user enumeration
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    admin.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    admin.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await admin.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const message = `You requested a password reset. Please visit: ${resetUrl}`;

    try {
      await sendEmail({
        email: admin.email,
        subject: 'Password Reset Request',
        message,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (emailError: any) {
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpire = undefined;
      await admin.save();

      res.status(500).json({
        success: false,
        message: 'Error sending reset email',
        error: emailError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: error.message,
    });
  }
};

// ✅ RESET PASSWORD
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    admin.password = password;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save();

    const newToken = generateToken(admin._id.toString());

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: { token: newToken },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message,
    });
  }
};

// ✅ ADMIN LOGIN
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
      return;
    }

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin._id.toString());

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar,
          role: admin.role || 'user',
        },
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message,
    });
  }
};