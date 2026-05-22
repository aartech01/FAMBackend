// middleware/rateLimiter.js - SIMPLIFIED VERSION
import rateLimit from "express-rate-limit";

// Simple login rate limiter
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Simple API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: {
    success: false,
    message: "Too many requests, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: "Too many requests, please try again after an hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const roleBasedRateLimiter = (role) => {
  const limits = {
    admin: 10,
    organizer: 5,
    user: 5
  };
  
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: limits[role] || 5,
    message: {
      success: false,
      message: `Too many ${role} login attempts, please try again later`
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
};