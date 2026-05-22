// routes/reportRoutes.js
/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: User-submitted reports and admin/organizer review
 */
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { isAdmin, isAdminOrOrganizer } from "../middleware/roleMiddleware.js";
import {
  submitReport,
  getAllReports,
  reviewReport,
  getReportsByEvent,
} from "../controllers/reportController.js";

const router = express.Router();

router.use(verifyToken);

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Submit a report against a user or content
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportedUserId, reason]
 *             properties:
 *               reportedUserId: { type: string }
 *               reason: { type: string }
 *               eventId: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Report submitted
 *   get:
 *     summary: List all reports (admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of report objects
 */
router.post("/", submitReport);
router.get("/", isAdmin, getAllReports);

/**
 * @swagger
 * /api/reports/{id}/review:
 *   patch:
 *     summary: Review a report — mark as reviewed or dismissed (admin only)
 *     tags: [Reports]
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
 *               status: { type: string, enum: [reviewed, dismissed] }
 *               adminNote: { type: string }
 *     responses:
 *       200:
 *         description: Report reviewed
 */
router.patch("/:id/review", isAdmin, reviewReport);

/**
 * @swagger
 * /api/reports/event/{eventId}:
 *   get:
 *     summary: Get reports for a specific event (admin or organizer)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reports for the event
 */
router.get("/event/:eventId", isAdminOrOrganizer, getReportsByEvent);

export default router;
