// routes/authRoutes.js
import express from "express";
import {
  sendOtp,
  verifyOtp,
  logout,
  getProfile,
  refreshToken,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User OTP authentication
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to user's email/phone
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent. isNewUser=true means username+dob required on verify-otp.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 isNewUser: { type: boolean }
 *       429:
 *         description: Too many requests
 */
router.post("/send-otp", loginRateLimiter, sendOtp);


/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and receive JWT tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               username:
 *                 type: string
 *                 description: Required only when isNewUser=true
 *               dob:
 *                 type: string
 *                 format: date
 *                 description: Required only when isNewUser=true
 *     responses:
 *       200:
 *         description: Login successful — returns access token, refresh token, and user object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 token: { type: string }
 *                 refreshToken: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/verify-otp", loginRateLimiter, verifyOtp);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Exchange refresh token for a new access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Invalidate current session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/logout", verifyToken, logout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 *       401:
 *         description: Unauthorized
 */
router.get("/profile", verifyToken, getProfile);

export default router;