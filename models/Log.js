// models/Log.js
import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "userModel",
  },
  userModel: {
    type: String,
    enum: ["Admin", "Organizer", "User"],
  },
  role: {
    type: String,
    enum: ["admin", "organizer", "user"],
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  module: {
    type: String,
    enum: ["auth", "event", "tree", "user", "admin", "organizer", "notification", "moderation"],
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for faster queries
logSchema.index({ createdAt: -1 });
logSchema.index({ userId: 1, module: 1 });
logSchema.index({ role: 1, action: 1 });

const Log = mongoose.model("Log", logSchema);
export default Log;