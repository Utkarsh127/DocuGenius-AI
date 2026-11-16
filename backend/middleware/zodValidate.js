import { z } from 'zod';

/**
 * Zod schemas for request validation.
 */
export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});

export const generateDocSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty'),
  type: z.enum(['pptx', 'docx', 'txt'], {
    required_error: 'Document type is required (pptx, docx, or txt)',
  }),
  topic: z.string().trim().optional(),
  description: z.string().trim().optional(),
  settings: z
    .object({
      language: z.string().optional(),
      tone: z.string().optional(),
      audience: z.string().optional(),
      contentLength: z.string().optional(),
      slideCount: z.number().int().min(1).max(50).optional(),
      theme: z.string().optional(),
    })
    .optional(),
});

/**
 * Middleware factory for validating request bodies with a Zod schema.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const formattedErrors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors,
    });
  }

  // Replace req.body with sanitized and parsed data
  req.body = result.data;
  next();
};

