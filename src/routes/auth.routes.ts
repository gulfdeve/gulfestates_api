// src/routes/auth.routes.ts
import express from 'express';
import { register, login, getMe, forgotPassword, resetPassword, adminLogin } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { 
  registerValidation, 
  loginValidation, 
  forgotPasswordValidation,
  resetPasswordValidation,
  validate 
} from '../middleware/validation.middleware.js';
import { 
  loginRateLimiter, 
  forgotPasswordRateLimiter, 
  resetPasswordRateLimiter 
} from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// ✅ Register route with validation
router.post('/register', registerValidation, validate, register);

// ✅ Login route with validation - Rate limited: 10 attempts per hour per IP
router.post('/login', loginRateLimiter, loginValidation, validate, login);

// ✅ Admin login route (same as login, kept for backward compatibility) - Rate limited: 10 attempts per hour per IP
router.post('/admin/login', loginRateLimiter, loginValidation, validate, adminLogin);

// ✅ Get current admin profile
router.get('/me', protect, getMe);

// ✅ Password reset routes - Rate limited and validated
router.post('/forgot-password', forgotPasswordRateLimiter, forgotPasswordValidation, validate, forgotPassword);
router.put('/reset-password/:token', resetPasswordRateLimiter, resetPasswordValidation, validate, resetPassword);

export default router;
