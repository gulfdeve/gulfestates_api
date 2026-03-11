import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter Configurations
 * Separate rate limiters for different endpoints
 */

/**
 * Contact Form Rate Limiter
 * 30 requests per day (24 hours) per IP
 */
export const contactRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    message: 'Too many contact form submissions from this IP, please try again after 24 hours.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP address from request
  keyGenerator: (req) => {
    // Get IP from various sources (proxy, load balancer, etc.)
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

export const newsletterRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    message: 'Too many newsletter subscription attempts from this IP, please try again after 24 hours.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Home Page Leads Rate Limiter
 * 30 requests per day (24 hours) per IP
 */
export const homePageLeadRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    message: 'Too many lead submissions from this IP, please try again after 24 hours.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Login Rate Limiter
 * 10 login attempts per hour per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful login attempts
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Forgot Password Rate Limiter
 * 3 requests per hour per IP (to prevent email spam and abuse)
 */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 10, // Limit each IP to 3 forgot password requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email as additional key to prevent abuse of specific emails
    const email = (req.body?.email as string) || '';
    const ip = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
    return `${ip}:${email.toLowerCase()}`;
  },
});

/**
 * Reset Password Rate Limiter
 * 5 attempts per hour per IP (to prevent brute force attacks)
 */
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 10, // Limit each IP to 5 reset password attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful resets
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Job Application Rate Limiter
 * 5 applications per hour per IP (to prevent spam and abuse)
 */
export const jobApplicationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 5, // Limit each IP to 5 job applications per hour
  message: {
    success: false,
    message: 'Too many job applications from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email as additional key to prevent abuse of specific job postings
    const email = (req.body?.email as string) || '';
    const ip = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
    return `${ip}:${email.toLowerCase()}`;
  },
});

/**
 * Blog Rate Limiter
 * 50 requests per 2 hours per IP (for users only, admins are excluded)
 */
export const blogRateLimiter = rateLimit({
  windowMs: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message: 'Too many blog requests from this IP, please try again after 2 hours.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin requests
  skip: (req) => {
    // Check if request is from admin
    const isAdmin = 
      req.query.admin === 'true' || 
      req.headers['x-admin-view'] === 'true' ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer'));
    
    // Return true to skip rate limiting for admins
    return !!isAdmin;
  },
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * OffPlan Rate Limiter
 * 100 requests per hour per IP (for users only, admins are excluded)
 */
export const offPlanRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many off-plan requests from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin requests
  skip: (req) => {
    const isAdmin = 
      req.query.admin === 'true' || 
      req.headers['x-admin-view'] === 'true' ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer'));
    
    return !!isAdmin;
  },
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Property Rate Limiter
 * 100 requests per hour per IP (for users only, admins are excluded)
 */
export const propertyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many property requests from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin requests
  skip: (req) => {
    const isAdmin = 
      req.query.admin === 'true' || 
      req.headers['x-admin-view'] === 'true' ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer'));
    
    return !!isAdmin;
  },
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Testimonial Rate Limiter
 * 100 requests per hour per IP (for users only, admins are excluded)
 */
export const testimonialRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many testimonial requests from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin requests
  skip: (req) => {
    const isAdmin = 
      req.query.admin === 'true' || 
      req.headers['x-admin-view'] === 'true' ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer'));
    
    return !!isAdmin;
  },
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

export const pagesContentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many pages content requests from this IP, please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin requests
  skip: (req) => {
    const isAdmin = 
      req.query.admin === 'true' || 
      req.headers['x-admin-view'] === 'true' ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer'));
    
    return !!isAdmin;
  },
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

