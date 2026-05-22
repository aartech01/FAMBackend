// models/TreeHistory.js
import mongoose from "mongoose";

const treeHistorySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  familySide: {
    type: String,
    enum: ["common", "groom", "bride"],
    default: "common",
  },
  rootUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  nodes: [{
    id: String,
    name: String,
    email: String,
    dob: Date,
    gender: String,
    generation: Number,
    profileImage: String,
  }],
  edges: [{
    from: String,
    to: String,
    relation: String,
  }],
  generatedMermaidCode: {
    type: String,
  },
  version: {
    type: Number,
    default: 1,
  },
  snapshotDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
treeHistorySchema.index({ eventId: 1, familySide: 1, version: -1 });

const TreeHistory = mongoose.model("TreeHistory", treeHistorySchema);
export default TreeHistory;