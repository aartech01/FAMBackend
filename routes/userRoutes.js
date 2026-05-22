// routes/userRoutes.js
/**
 * @swagger
 * tags:
 *   name: User
 *   description: Authenticated user profile and notification preferences
 */
import express from "express";
import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  getUserHistory,
  getUserNotifications,
  updateNotificationPreferences,
  getMemberProfile,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";

const router = express.Router();

// All user routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 *   patch:
 *     summary: Update current user's profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               dob: { type: string, format: date }
 *               bio: { type: string }
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.get("/profile/:userId", getMemberProfile);

/**
 * @swagger
 * /api/user/profile/upload-image:
 *   post:
 *     summary: Upload a new profile image (multipart/form-data)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded, returns Cloudinary URL
 *       400:
 *         description: Invalid file or upload error
 */
router.post("/profile/upload-image", (req, res, next) => {
  uploadImage.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, uploadProfileImage);

/**
 * @swagger
 * /api/user/history:
 *   get:
 *     summary: Get user's event join history
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of past events
 */
router.get("/history", getUserHistory);

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     summary: Get user's notifications
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of notification objects
 */
router.get("/notifications", getUserNotifications);

/**
 * @swagger
 * /api/user/notifications/preferences:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: boolean }
 *               push: { type: boolean }
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.patch("/notifications/preferences", updateNotificationPreferences);

export default router;