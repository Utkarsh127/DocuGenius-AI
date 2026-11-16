import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { success, error } from '../utils/responseHelper.js';

/**
 * Generate a JWT for the given user.
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Set JWT as httpOnly cookie on the response.
 */
const setCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  res.cookie('token', token, cookieOptions);
};

/**
 * POST /register
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return error(res, 'An account with this email already exists.', 409);
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Generate token & set cookie
    const token = generateToken(user);
    setCookie(res, token);

    return success(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
      201
    );
  } catch (err) {
    console.error('[authController] register error:', err.message);
    return error(res, 'Registration failed. Please try again.');
  }
};

/**
 * POST /login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return error(res, 'Invalid email or password.', 401);
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return error(res, 'Invalid email or password.', 401);
    }

    // Generate token & set cookie
    const token = generateToken(user);
    setCookie(res, token);

    return success(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error('[authController] login error:', err.message);
    return error(res, 'Login failed. Please try again.');
  }
};

/**
 * POST /logout
 */
export const logout = async (_req, res) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
    });
    return success(res, { message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[authController] logout error:', err.message);
    return error(res, 'Logout failed.');
  }
};

/**
 * GET /me
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return error(res, 'User not found.', 404);
    }

    return success(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('[authController] getMe error:', err.message);
    return error(res, 'Failed to fetch user data.');
  }
};
