/**
 * Redact sensitive credentials (URIs, JWTs, API keys, passwords) from error messages.
 */
const redactSecrets = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
    .replace(/(Bearer\s+)[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/gi, '$1[REDACTED_JWT]')
    .replace(/(?:[?&]|\b)(key|api_?key|secret|token|password)=([^\s&"']+)/gi, '$1=[REDACTED]');
};

/**
 * Centralized error handling middleware.
 * Catches all errors from async route handlers and formats standard responses.
 */
export const errorHandler = (err, req, res, next) => {
  // Log error stack in non-production with credentials redacted
  if (process.env.NODE_ENV !== 'test') {
    const rawMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
    console.error(`[Error] ${req.method} ${req.url}:`, redactSecrets(rawMsg));
  }

  // 1. JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload provided',
    });
  }

  // 2. Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: messages,
    });
  }

  // 3. Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `An entry with that ${field} already exists.`,
    });
  }

  // 4. Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Resource not found with id of ${err.value}`,
    });
  }

  // 5. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication token has expired',
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error',
  });
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

