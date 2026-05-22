// routes/eventRoutes.js
/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event discovery, joining, and management
 */
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { isAdmin } from "../middleware/roleMiddleware.js";
import { apiRateLimiter } from "../middleware/rateLimiter.js";
import {
  joinEvent,
  validateEventCode,
  getEvent,
  getEventQR,
  getAllEvents,
  updateEvent,
  getEventParticipants,
} from "../controllers/eventController.js";

const router = express.Router();

/**
 * @swagger
 * /api/events/validate-code:
 *   post:
 *     summary: Validate an event join code (public)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventCode]
 *             properties:
 *               eventCode: { type: string, example: ABC123 }
 *     responses:
 *       200:
 *         description: Event found — returns event summary
 *       404:
 *         description: Invalid event code
 */
router.post("/validate-code", apiRateLimiter, validateEventCode);

// Protected routes
router.use(verifyToken);

/**
 * @swagger
 * /api/events/join:
 *   post:
 *     summary: Join an event using event code
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventCode]
 *             properties:
 *               eventCode: { type: string }
 *     responses:
 *       200:
 *         description: joinStatus is "approved" or "pending_approval"
 *       400:
 *         description: Already joined or invalid code
 */
router.post("/join", joinEvent);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: List events the authenticated user has joined
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of events
 */
router.get("/", getAllEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event object
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update event (admin only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               eventDate: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Event updated
 */
router.get("/:id", getEvent);

/**
 * @swagger
 * /api/events/{id}/qr:
 *   get:
 *     summary: Get QR code image for an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: QR code as data URL or image
 */
router.get("/:id/qr", getEventQR);

/**
 * @swagger
 * /api/events/{eventId}/participants:
 *   get:
 *     summary: List participants of an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of participant users
 */
router.get("/:eventId/participants", getEventParticipants);
router.patch("/:id", isAdmin, updateEvent);

export default router;