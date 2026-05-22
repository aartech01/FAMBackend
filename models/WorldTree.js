// models/WorldTree.js
import mongoose from "mongoose";

const worldTreeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  paymentId: String,
  paymentDate: Date,
  amount: Number,
  validTill: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
  treeData: {
    nodes: [Object],
    edges: [Object],
  },
  privacyMode: {
    type: String,
    enum: ["public", "private", "family-only"],
    default: "private",
  },
  createdAt: Date,
  updatedAt: Date,
});

const WorldTree = mongoose.model("WorldTree", worldTreeSchema);
export default WorldTree;