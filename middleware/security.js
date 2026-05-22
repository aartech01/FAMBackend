// middleware/security.js
// Note: express-mongo-sanitize and xss-clean both try to overwrite req.query,
// which is a read-only getter in Express 5. They are excluded here.
// XSS/injection prevention is provided by Helmet headers, Mongoose parameterized
// queries, and the sanitizeInput helper below.

export const securityMiddleware = [
  (req, res, next) => {
    res.removeHeader("X-Powered-By");
    next();
  },
];

// Input sanitization for request body
export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    // Strip leading $ from keys only — prevents MongoDB operator injection
    // Do NOT modify values (would corrupt emails, names, URLs)
    const sanitize = (obj) => {
      for (const key of Object.keys(obj)) {
        const safeKey = key.replace(/^\$+/, '');
        if (safeKey !== key) { obj[safeKey] = obj[key]; delete obj[key]; }
        if (obj[safeKey] && typeof obj[safeKey] === 'object') sanitize(obj[safeKey]);
      }
    };
    sanitize(req.body);
  }
  next();
};

// Request size limiter
export const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.headers["content-length"]) || 0;
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: "Request entity too large",
    });
  }
  next();
};