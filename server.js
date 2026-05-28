






// server.js
import dns from "dns";
dns.setDefaultResultOrder("ipv4first"); // Railway doesn't support IPv6 outbound — force IPv4 for all DNS lookups

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { setupSocketIO } from "./sockets/index.js";
import { startCronJobs } from "./cron/jobs.js";
import { setSocketIO } from "./services/notificationService.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import organizerRoutes from "./routes/organizerRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import treeRoutes from "./routes/treeRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import worldTreeRoutes from "./routes/worldTreeRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

// Swagger
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

// Middleware
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { securityMiddleware, sanitizeInput } from "./middleware/security.js";

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

// Parse allowed origins from CORS_ORIGIN (comma-separated) or fall back to CLIENT_URL
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOriginFn = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} not allowed`));
};

// Create io instance - ONLY ONCE
const io = new Server(server, {
  cors: {
    origin: corsOriginFn,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// Set socket instance for notification service
setSocketIO(io);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: corsOriginFn,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(securityMiddleware);
app.use(sanitizeInput);
app.use(apiRateLimiter);

// Database Connections
await connectDB();
await connectRedis();

// Socket.IO Setup
setupSocketIO(io);

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/user", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/tree", treeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/world-tree", worldTreeRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/reports", reportRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date(),
    routes: {
      auth: "/api/auth",
      admin: "/api/admin",
      organizer: "/api/organizer",
      user: "/api/user",
      events: "/api/events",
      tree: "/api/tree",
      notifications: "/api/notifications",
    }
  });
});

// Start Cron Jobs
startCronJobs(io);

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`📋 API Routes:`);
  console.log(`   - POST   /api/auth/send-otp      - Send OTP for user login`);
  console.log(`   - POST   /api/auth/verify-otp    - Verify OTP and login`);
  console.log(`   - POST   /api/admin/login        - Admin login`);
  console.log(`   - POST   /api/organizer/login    - Organizer login`);
  console.log(`   - GET    /api/user/profile       - Get user profile`);
  console.log(`   - POST   /api/events/join        - Join event via QR/Code`);
  console.log(`   - POST   /api/tree/add-relation  - Add family relationship`);
});

export { io };