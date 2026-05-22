// routes/worldTreeRoutes.js
/**
 * @swagger
 * tags:
 *   name: WorldTree
 *   description: Premium personal family tree (payment-gated, 1-year validity)
 */
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  activateWorldTree,
  getWorldTree,
  addToWorldTree,
} from "../controllers/worldTreeController.js";

const router = express.Router();

router.use(verifyToken);

/**
 * @swagger
 * /api/world-tree/activate:
 *   post:
 *     summary: Activate WorldTree subscription (payment stub — not yet integrated)
 *     tags: [WorldTree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privacyMode: { type: string, enum: [public, private, family-only], default: private }
 *     responses:
 *       200:
 *         description: WorldTree activated with 1-year validity
 */
router.post("/activate", activateWorldTree);

/**
 * @swagger
 * /api/world-tree/my-tree:
 *   get:
 *     summary: Get the current user's personal WorldTree
 *     tags: [WorldTree]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WorldTree object with nodes and edges
 *       403:
 *         description: Subscription inactive or expired
 */
router.get("/my-tree", getWorldTree);

/**
 * @swagger
 * /api/world-tree/add-data:
 *   post:
 *     summary: Add a person or relationship to personal WorldTree
 *     tags: [WorldTree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               personData: { type: object }
 *               relationship: { type: object }
 *     responses:
 *       200:
 *         description: Data added to WorldTree
 */
router.post("/add-data", addToWorldTree);

export default router;