import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { isOrganizer } from "../middleware/roleMiddleware.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";
import {
  organizerLogin,
  organizerLogout,
  getOrganizerProfile,
  getAssignedEvent,
  getEventParticipants,
  updateEventSchedule,
  getOrganizerStats,
  getPendingApprovals,
  getEventApprovalMode,
  approveUser,
  rejectUser,
  getUnvalidatedRelationships,
  validateRelationship,
  manuallyAddUser,
  updateEventApprovalModeOrganizer,
} from "../controllers/organizerController.js";

/**
 * @swagger
 * tags:
 *   name: Organizer
 *   description: Organizer endpoints — email+password auth, single assigned event
 */

const router = express.Router();

/**
 * @swagger
 * /api/organizer/login:
 *   post:
 *     summary: Organizer login with email + password
 *     tags: [Organizer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Returns access token, refresh token, organizer profile
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", loginRateLimiter, organizerLogin);

// Protected routes (require organizer authentication)
router.use(verifyToken);
router.use(isOrganizer);

/**
 * @swagger
 * /api/organizer/logout:
 *   post:
 *     summary: Organizer logout
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post("/logout", organizerLogout);

/**
 * @swagger
 * /api/organizer/profile:
 *   get:
 *     summary: Get organizer profile
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizer profile object
 */
router.get("/profile", getOrganizerProfile);

/**
 * @swagger
 * /api/organizer/assigned-event:
 *   get:
 *     summary: Get the event assigned to this organizer
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assigned event details
 */
router.get("/assigned-event", getAssignedEvent);

/**
 * @swagger
 * /api/organizer/participants:
 *   get:
 *     summary: List participants of the assigned event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of participants
 */
router.get("/participants", getEventParticipants);

/**
 * @swagger
 * /api/organizer/schedule:
 *   patch:
 *     summary: Update event schedule
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: Schedule updated
 */
router.patch("/schedule", updateEventSchedule);

/**
 * @swagger
 * /api/organizer/stats:
 *   get:
 *     summary: Get organizer dashboard statistics
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats for assigned event
 */
router.get("/stats", getOrganizerStats);

/**
 * @swagger
 * /api/organizer/pending-approvals:
 *   get:
 *     summary: List users pending approval to join the event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of pending users
 */
router.get("/pending-approvals", getPendingApprovals);

/**
 * @swagger
 * /api/organizer/event/get-approval-mode:
 *   get:
 *     summary: Get current approval mode of the assigned event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: approvalMode is "auto" or "manual"
 */
router.get("/event/get-approval-mode", getEventApprovalMode);

/**
 * @swagger
 * /api/organizer/manual-add-user:
 *   post:
 *     summary: Manually add a user to the event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       200:
 *         description: User added to event
 */
router.post("/manual-add-user", manuallyAddUser);

/**
 * @swagger
 * /api/organizer/event/approval-mode:
 *   patch:
 *     summary: Update approval mode for the assigned event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approvalMode]
 *             properties:
 *               approvalMode: { type: string, enum: [auto, manual] }
 *     responses:
 *       200:
 *         description: Approval mode updated
 */
router.patch("/event/approval-mode", updateEventApprovalModeOrganizer);

/**
 * @swagger
 * /api/organizer/approve/{userId}:
 *   patch:
 *     summary: Approve a pending user to join the event
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User approved
 */
router.patch("/approve/:userId", approveUser);

/**
 * @swagger
 * /api/organizer/reject/{userId}:
 *   patch:
 *     summary: Reject a pending user
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User rejected
 */
router.patch("/reject/:userId", rejectUser);

/**
 * @swagger
 * /api/organizer/unvalidated-relationships:
 *   get:
 *     summary: List family relationships awaiting organizer validation
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of unvalidated relationships
 */
router.get("/unvalidated-relationships", getUnvalidatedRelationships);

/**
 * @swagger
 * /api/organizer/validate-relationship/{id}:
 *   patch:
 *     summary: Validate or reject a proposed relationship
 *     tags: [Organizer]
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
 *               action: { type: string, enum: [approve, reject] }
 *     responses:
 *       200:
 *         description: Relationship validated/rejected
 */
router.patch("/validate-relationship/:id", validateRelationship);

export default router;