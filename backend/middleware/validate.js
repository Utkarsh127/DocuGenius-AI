import { body, validationResult } from 'express-validator';

/**
 * Validation chain for user registration.
 */
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

/**
 * Validation chain for user login.
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Validation chain for document generation.
 */
export const validateGenerate = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type')
    .notEmpty()
    .withMessage('Document type is required')
    .isIn(['pptx', 'docx', 'txt'])
    .withMessage('Type must be one of: pptx, docx, txt'),
  body('topic').optional().trim(),
  body('description').optional().trim(),
  body('settings').optional().isObject().withMessage('Settings must be an object'),
];

/**
 * Middleware that checks express-validator results and returns 400 with errors array.
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};
