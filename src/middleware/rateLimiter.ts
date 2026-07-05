import rateLimit from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

export const unauthenticatedScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => !!req.headers.authorization,
  handler: (_req, res, _next, options) => {
    const resetTime = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      error: 'Rate limit exceeded',
      limit: options.max,
      current: options.max,
      retryAfterSeconds: resetTime,
      message: 'Unauthenticated scan limit: 5 per hour. Please sign in for more.',
    });
  },
});

export const authenticatedScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authReq = req as { userId?: string };
    return authReq.userId || req.ip || 'unknown';
  },
  skip: (req) => !req.headers.authorization,
  handler: (_req, res, _next, options) => {
    const resetTime = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      error: 'Rate limit exceeded',
      limit: options.max,
      current: options.max,
      retryAfterSeconds: resetTime,
      message: 'Authenticated scan limit: 20 per hour.',
    });
  },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat rate limit exceeded. Please wait a moment.' },
});
