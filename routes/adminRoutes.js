import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { isAdmin } from "../middleware/roleMiddleware.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  createOrganizer,
  getAllOrganizers,
  getOrganizerById,
  updateOrganizer,
  removeOrganizer,
  reactivateOrganizer,
  getAllUsers,
  getEventUsers,
  getAllEventsWithUserCounts,
  getEventUserDetails,
  blockUser,
  getBlockedUsers,
  getBlockedUserDetails,
  getBlockedUsersSummary,
  unblockAllUsers,
  unblockUser,
  getAllEventsAdmin,
  deleteEvent,
  getSystemLogs,
  getDashboardStats,
  createEvent,
  getEventByIdOrCode,
  getEventById,
  getEventByCode,
  updateEventApprovalMode,
  updateTreeVisibility,
  approveUserAdmin,
  rejectUserAdmin,
  updateEvent,
} from "../controllers/adminController.js";
import {
  getAllReports,
  reviewReport,
  getReportsByEvent,
} from "../controllers/reportController.js";

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only management endpoints (Bearer token with role=admin required)
 */

const router = express.Router();

// TEST ROUTE - Add this at the very top
router.post("/test", (req, res) => {
  res.json({ success: true, message: "Test route working" });
});

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin login with name + password
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, password]
 *             properties:
 *               name: { type: string, example: admin }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       200:
 *         description: Returns access token, refresh token, admin object
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", loginRateLimiter, adminLogin);

// Protected routes (require admin authentication)
router.use(verifyToken);
router.use(isAdmin);

// Test protected route
router.get("/test-protected", (req, res) => {
  res.json({
    success: true,
    message: "Protected route working",
    user: req.user,
  });
});

/**
 * @swagger
 * /api/admin/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post("/logout", adminLogout);

/**
 * @swagger
 * /api/admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile
 */
router.get("/profile", getAdminProfile);

/**
 * @swagger
 * /api/admin/organizers:
 *   post:
 *     summary: Create a new organizer (also creates the associated event)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, eventId]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               eventId: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *               validTill: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Organizer created
 *   get:
 *     summary: List all organizers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of organizer objects
 */
router.post("/organizers", createOrganizer);
router.get("/organizers", getAllOrganizers);

/**
 * @swagger
 * /api/admin/organizers/{id}:
 *   get:
 *     summary: Get organizer by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizer object
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update organizer
 *     tags: [Admin]
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
 *               name: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *               validTill: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Updated organizer
 *   delete:
 *     summary: Remove organizer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizer removed
 */
router.get("/organizers/:id", getOrganizerById);
router.patch("/organizers/:id", updateOrganizer);
router.delete("/organizers/:id", removeOrganizer);

/**
 * @swagger
 * /api/admin/organizers/{id}/reactivate:
 *   patch:
 *     summary: Reactivate a deactivated organizer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizer reactivated
 */
router.patch("/organizers/:id/reactivate", reactivateOrganizer);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user objects
 */
router.get("/users", getAllUsers);

/**
 * @swagger
 * /api/admin/events/{eventId}/users:
 *   get:
 *     summary: Get users for a specific event
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of users in the event
 */
router.get("/events/:eventId/users", getEventUsers);

/**
 * @swagger
 * /api/admin/events/summary:
 *   get:
 *     summary: Get all events with participant counts
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Events with user counts
 */
router.get("/events/summary", getAllEventsWithUserCounts);

/**
 * @swagger
 * /api/admin/events/{eventId}/users/{userId}:
 *   get:
 *     summary: Get details of a specific user in an event
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User event detail
 */
router.get("/events/:eventId/users/:userId", getEventUserDetails);

/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   patch:
 *     summary: Block a user
 *     tags: [Admin]
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
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: User blocked
 */
router.patch("/users/:id/block", blockUser);

/**
 * @swagger
 * /api/admin/users/blocked:
 *   get:
 *     summary: List all blocked users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of blocked users
 */
router.get("/users/blocked", getBlockedUsers);

/**
 * @swagger
 * /api/admin/users/blocked/summary:
 *   get:
 *     summary: Summary stats of blocked users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked users summary
 */
router.get("/users/blocked/summary", getBlockedUsersSummary);

/**
 * @swagger
 * /api/admin/users/blocked/{userId}:
 *   get:
 *     summary: Get details of a blocked user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Blocked user detail
 */
router.get("/users/blocked/:userId", getBlockedUserDetails);

/**
 * @swagger
 * /api/admin/users/blocked/bulk-unblock:
 *   post:
 *     summary: Unblock all currently blocked users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All users unblocked
 */
router.post("/users/blocked/bulk-unblock", unblockAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}/unblock:
 *   patch:
 *     summary: Unblock a specific user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User unblocked
 */
router.patch("/users/:id/unblock", unblockUser);

/**
 * @swagger
 * /api/admin/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, organizerEmail, eventDate]
 *             properties:
 *               title: { type: string }
 *               organizerEmail: { type: string }
 *               eventDate: { type: string, format: date }
 *               approvalMode: { type: string, enum: [auto, manual], default: auto }
 *               treeType: { type: string, enum: [common, wedding, anniversary] }
 *     responses:
 *       201:
 *         description: Event created, organizer account emailed
 *   get:
 *     summary: List all events
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of events
 */
router.post("/events", createEvent);
router.get("/events/lookup/:identifier", getEventByIdOrCode);
router.get("/events/id/:id", getEventById);
router.get("/events/code/:code", getEventByCode);
router.get("/events", getAllEventsAdmin);

/**
 * @swagger
 * /api/admin/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event deleted
 */
router.patch("/events/:id", updateEvent);
router.delete("/events/:id", deleteEvent);

/**
 * @swagger
 * /api/admin/events/{id}/approval-mode:
 *   patch:
 *     summary: Update event join approval mode (auto/manual)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
router.patch("/events/:id/approval-mode", updateEventApprovalMode);
router.patch("/events/:eventId/approve/:userId", approveUserAdmin);
router.patch("/events/:eventId/reject/:userId", rejectUserAdmin);

/**
 * @swagger
 * /api/admin/events/{id}/tree-visibility:
 *   patch:
 *     summary: Toggle tree visibility for an event
 *     tags: [Admin]
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
 *               treeVisible: { type: boolean }
 *     responses:
 *       200:
 *         description: Tree visibility updated
 */
router.patch("/events/:id/tree-visibility", updateTreeVisibility);

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: List all user reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of reports
 */
router.get("/reports", getAllReports);

/**
 * @swagger
 * /api/admin/reports/{id}/review:
 *   patch:
 *     summary: Review (accept/reject) a report
 *     tags: [Admin]
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
router.patch("/reports/:id/review", reviewReport);

/**
 * @swagger
 * /api/admin/reports/event/{eventId}:
 *   get:
 *     summary: Get reports for a specific event
 *     tags: [Admin]
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
router.get("/reports/event/:eventId", getReportsByEvent);

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 */
router.get("/logs", getSystemLogs);

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats (users, events, organizers counts)
 */
router.get("/dashboard/stats", getDashboardStats);

export default router;
