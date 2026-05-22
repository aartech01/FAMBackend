// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["birthday", "anniversary", "new_member", "event_update", "schedule_change", "approval"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  deliveryMethod: {
    type: String,
    enum: ["email", "in-app", "both"],
    default: "both",
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;