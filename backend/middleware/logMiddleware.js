import { logger } from "./logger.js";

/**
 * Redact sensitive query parameters from logged URL if present.
 */
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const qIndex = rawUrl.indexOf('?');
    if (qIndex === -1) return rawUrl;

    const pathPart = rawUrl.substring(0, qIndex);
    const queryString = rawUrl.substring(qIndex + 1);
    const searchParams = new URLSearchParams(queryString);

    const sensitivePattern = /^(password|token|secret|key|api_key|access_token|auth|credential)$/i;
    let modified = false;

    for (const key of searchParams.keys()) {
      if (sensitivePattern.test(key)) {
        searchParams.set(key, '[REDACTED]');
        modified = true;
      }
    }

    return modified ? `${pathPart}?${searchParams.toString()}` : rawUrl;
  } catch {
    return rawUrl;
  }
}

export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    // Extract strictly non-PII user identifier
    const userId = req.user?.id
      ? String(req.user.id)
      : req.user?._id
        ? String(req.user._id)
        : (typeof req.user === 'string' && req.user !== 'anonymous' ? req.user : 'anonymous');

    logger.info({
      type: "API",
      method: req.method,
      url: sanitizeUrl(req.originalUrl || req.url),
      status: res.statusCode,
      responseTime: Date.now() - start,
      userId,
      user: userId, // Preserved as safe string ID for backwards compatibility
      timestamp: new Date().toISOString()
    });
  });

  next();
}
