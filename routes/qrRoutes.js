// routes/qrRoutes.js
/**
 * @swagger
 * tags:
 *   name: QR
 *   description: Public QR-code join flow — no authentication required
 */
import express from "express";
import {
  joinEventFromQR,
  getEventJoinForm,
  getTreeMembers,
} from "../controllers/qrJoinController.js";

const router = express.Router();

/**
 * @swagger
 * /api/qr/event-form/{eventId}:
 *   get:
 *     summary: Get the dynamic form field definitions for a QR join
 *     tags: [QR]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of form field definitions
 *       404:
 *         description: Event not found
 */
router.get("/event-form/:eventId", getEventJoinForm);
router.get("/tree-members/:eventId", getTreeMembers);

/**
 * @swagger
 * /api/qr/join-from-qr:
 *   post:
 *     summary: Submit QR join form to request event access
 *     tags: [QR]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, name, email]
 *             properties:
 *               eventId: { type: string }
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               profilePhoto:
 *                 type: string
 *                 description: Base64 data URL of the profile photo
 *                 example: data:image/jpeg;base64,/9j/4AAQ...
 *     responses:
 *       200:
 *         description: joinStatus is "approved" (auto mode) or "pending_approval" (manual mode)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 joinStatus: { type: string, enum: [approved, pending_approval] }
 *                 message: { type: string }
 */
router.post("/join-from-qr", joinEventFromQR);

export default router;
