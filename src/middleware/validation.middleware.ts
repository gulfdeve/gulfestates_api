import { Request, Response, NextFunction } from 'express';
import { validationResult, body } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

export const registerValidation = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  }),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required')
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
];

export const resetPasswordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)')
];

export const contactValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('countryCode')
    .notEmpty()
    .withMessage('Country code is required')
    .matches(/^\+?\d{1,4}$/)
    .withMessage('Invalid country code format'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters')
];

export const newsletterValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
];

export const homePageLeadValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),
  body('countryCode')
    .notEmpty()
    .withMessage('Country code is required')
    .matches(/^\+?\d{1,4}$/)
    .withMessage('Invalid country code format'),
  body('budget')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Budget must not exceed 50 characters'),
  body('propertyType')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Property type must not exceed 50 characters'),
  body('consent')
    .optional()
    .isBoolean()
    .withMessage('Consent must be a boolean value')
];

export const propertyValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('description').notEmpty().trim().withMessage('Description is required'),
  body('propertyType').isIn(['villa', 'apartment', 'penthouse', 'townhouse', 'commercial', 'land']).withMessage('Valid property type is required'),
  body('listingType').isIn(['sale', 'rent']).withMessage('Valid listing type is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('location.emirate').notEmpty().withMessage('Emirate is required'),
  body('specifications.bedrooms').isInt({ min: 0 }).withMessage('Valid number of bedrooms is required'),
  body('specifications.bathrooms').isInt({ min: 0 }).withMessage('Valid number of bathrooms is required'),
  body('specifications.area').isNumeric().withMessage('Area must be a number')
];

export const validateProperty = (req: Request, res: Response, next: NextFunction) => {
  const { title, price, location, type, beds, baths, size, for: propertyFor } = req.body;

  if (!title || !price || !location || !type || !beds || !baths || !size || !propertyFor) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: title, price, location, type, beds, baths, size, for'
    });
  }

  if (isNaN(Number(price)) || isNaN(Number(beds)) || isNaN(Number(baths)) || isNaN(Number(size))) {
    return res.status(400).json({
      success: false,
      message: 'Price, beds, baths, and size must be valid numbers'
    });
  }

  if (!['buy', 'rent'].includes(propertyFor)) {
    return res.status(400).json({
      success: false,
      message: 'Property type must be either "buy" or "rent"'
    });
  }

  next();
}; 