// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    eventCode: {
      type: String,
      required: true,
      unique: true,
    },
    qrCodeImage: {
      type: String,
    },
    description: {
      type: String,
    },
    eventType: {
      type: String,
      enum: ["wedding", "reunion", "birthday", "festival", "other"],
      default: "other",
    },
    eventDate: {
      type: Date,
      required: true,
    },
    eventEndDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    organizers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organizer",
      },
    ],
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    approvalMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "manual",
    },
    pendingApprovals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    schedule: [
      {
        title: String,
        description: String,
        dateTime: Date,
        location: String,
      },
    ],
    settings: {
      approvalRequired: { type: Boolean, default: false },
      maxMembersPerUser: { type: Number, default: 4 },
    },
    groomName: { type: String, trim: true },
    brideName: { type: String, trim: true },
    mainPersonName: { type: String, trim: true },
    treeType: {
      type: String,
      enum: ["wedding", "anniversary", "common"],
      default: "common",
    },
    treeConfig: {
      mainPersonId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      groomId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      brideId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    treeVisibility: {
      type: String,
      enum: ["participants", "organizer_only", "admin_only"],
      default: "participants",
    },
    hiddenFromTree: [
      {
        userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        hiddenBy: { type: mongoose.Schema.Types.ObjectId, required: true },
        hiddenAt: { type: Date, default: Date.now },
      },
    ],
    treeTheme: {
      type: String,
      enum: ["classic", "forest", "moonlit", "golden", "rose", "ivory", "sage", "obsidian", "champagne", "velvet"],
      default: "classic",
    },
    treeThemeLocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ isActive: 1, createdAt: -1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ eventCode: 1 }); // already unique, but explicit for query planner

const Event = mongoose.model("Event", eventSchema);
export default Event;
