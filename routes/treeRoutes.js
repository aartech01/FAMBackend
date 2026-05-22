// routes/treeRoutes.js
/**
 * @swagger
 * tags:
 *   name: Tree
 *   description: Family tree generation, relationship management, and moderation
 */
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { isAdminOrOrganizer } from "../middleware/roleMiddleware.js";
import {
  addRelationship,
  removeRelationship,
  updateRelationship,
  getTree,
  getTreeHistory,
  setMainPerson,
  setWeddingCouple,
  findRelationshipPath,
  hidePersonFromTree,
  restorePersonToTree,
} from "../controllers/treeController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /api/tree/generate/{eventId}:
 *   get:
 *     summary: Generate/get the family tree for an event
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: familySide
 *         schema: { type: string, enum: [groom, bride, common] }
 *         description: Filter by family side (wedding/anniversary events only)
 *     responses:
 *       200:
 *         description: Tree with nodes[], edges[], and mermaidCode
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nodes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       label: { type: string }
 *                       data:
 *                         type: object
 *                         properties:
 *                           username: { type: string }
 *                           profileImage: { type: string }
 *                           isDeceased: { type: boolean }
 *                           deathYear: { type: integer }
 *                 edges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source: { type: string }
 *                       target: { type: string }
 *                       label: { type: string }
 *                 mermaidCode: { type: string }
 */
router.get("/generate/:eventId", getTree);

/**
 * @swagger
 * /api/tree/history/{eventId}:
 *   get:
 *     summary: Get tree snapshot history for an event
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of tree snapshots ordered by date
 */
router.get("/history/:eventId", getTreeHistory);

/**
 * @swagger
 * /api/tree/path/{eventId}:
 *   get:
 *     summary: Find relationship path between two users
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: fromUserId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: toUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Path array of user IDs
 */
router.get("/path/:eventId", findRelationshipPath);

/**
 * @swagger
 * /api/tree/add-relation:
 *   post:
 *     summary: Propose a new family relationship (pending organizer validation)
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, relatedUserId, relationshipType]
 *             properties:
 *               eventId: { type: string }
 *               relatedUserId: { type: string }
 *               relationshipType: { type: string, example: parent }
 *               familySide: { type: string, enum: [groom, bride, common] }
 *     responses:
 *       201:
 *         description: Relationship proposed (isValidated=false)
 *       400:
 *         description: Validation error (duplicate, circular, age-gap violation, or limit exceeded)
 */
router.post("/add-relation", addRelationship);

/**
 * @swagger
 * /api/tree/remove-relation/{id}:
 *   delete:
 *     summary: Remove a relationship (admin/organizer only)
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Relationship removed
 */
router.delete("/remove-relation/:id", isAdminOrOrganizer, removeRelationship);

/**
 * @swagger
 * /api/tree/update-relation/{id}:
 *   patch:
 *     summary: Update a relationship (admin/organizer only)
 *     tags: [Tree]
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
 *               relationshipType: { type: string }
 *               familySide: { type: string }
 *     responses:
 *       200:
 *         description: Relationship updated
 */
router.patch("/update-relation/:id", isAdminOrOrganizer, updateRelationship);

/**
 * @swagger
 * /api/tree/set-main-person:
 *   post:
 *     summary: Set the root/main person of the tree (admin/organizer only)
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, userId]
 *             properties:
 *               eventId: { type: string }
 *               userId: { type: string }
 *     responses:
 *       200:
 *         description: Main person set
 */
router.post("/set-main-person", isAdminOrOrganizer, setMainPerson);

/**
 * @swagger
 * /api/tree/set-wedding-couple:
 *   post:
 *     summary: Set groom and bride for a wedding/anniversary tree (admin/organizer only)
 *     tags: [Tree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, groomId, brideId]
 *             properties:
 *               eventId: { type: string }
 *               groomId: { type: string }
 *               brideId: { type: string }
 *     responses:
 *       200:
 *         description: Wedding couple configured
 */
router.post("/set-wedding-couple", isAdminOrOrganizer, setWeddingCouple);

router.patch("/:eventId/hide-person",    isAdminOrOrganizer, hidePersonFromTree);
router.patch("/:eventId/restore-person", isAdminOrOrganizer, restorePersonToTree);

export default router;