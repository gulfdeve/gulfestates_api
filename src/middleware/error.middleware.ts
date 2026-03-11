import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let error = { ...err };
  error.message = err.message;

  // Log full error in development, sanitized in production
  if (isDevelopment) {
    console.error('Error Details:', err);
  } else {
    console.error('Error:', err.message || 'Unknown error');
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = isDevelopment ? 'Invalid resource ID format' : 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = isDevelopment 
      ? `Duplicate field value entered: ${Object.keys(err.keyPattern || {}).join(', ')}`
      : 'A record with this information already exists';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const validationMessages = Object.values(err.errors).map((e: any) => e.message);
    const message = isDevelopment 
      ? validationMessages.join(', ')
      : 'Invalid input data provided';
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = isDevelopment ? 'Invalid token' : 'Authentication failed';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = isDevelopment ? 'Token expired' : 'Session expired. Please login again';
    error = { message, statusCode: 401 };
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = isDevelopment ? 'File too large' : 'File size exceeds the maximum allowed limit';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = isDevelopment ? 'Unexpected file field' : 'Invalid file upload';
    error = { message, statusCode: 400 };
  }

  // Generic error messages for production
  const statusCode = error.statusCode || 500;
  const message = isDevelopment 
    ? (error.message || 'Server Error')
    : statusCode >= 500 
      ? 'An internal server error occurred. Please try again later.'
      : (error.message || 'An error occurred processing your request');

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDevelopment && { 
      error: {
        name: err.name,
        stack: err.stack,
        details: err
      }
    })
  });
};