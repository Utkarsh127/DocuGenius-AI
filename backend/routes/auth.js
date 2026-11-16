import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, validateBody } from '../middleware/zodValidate.js';
import { register, login, logout, getMe } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', authLimiter, validateBody(registerSchema), register);

// POST /api/auth/login
router.post('/login', authLimiter, validateBody(loginSchema), login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me  (protected)
router.get('/me', auth, getMe);

export default router;
