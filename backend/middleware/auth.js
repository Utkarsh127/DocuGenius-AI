import jwt from 'jsonwebtoken';
import { error } from '../utils/responseHelper.js';

/**
 * JWT authentication middleware.
 * Checks for token in: (a) cookies named 'token', (b) Authorization Bearer header.
 */
const auth = (req, res, next) => {
  let token;

  // 1. Check cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 2. Check Authorization header
  if (
    !token &&
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return error(res, 'Authentication required. No token provided.', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token.', 401);
  }
};

export { auth, auth as protect };
export default auth;
