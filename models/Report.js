import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reportedRelationship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Relationship",
    default: null,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  reason: {
    type: String,
    required: true,
    enum: ["fake_relationship", "inappropriate_content", "spam", "harassment", "incorrect_info", "other"],
  },
  description: {
    type: String,
    maxlength: 500,
    default: "",
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "dismissed", "actioned"],
    default: "pending",
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  reviewNote: {
    type: String,
    default: "",
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

reportSchema.index({ eventId: 1, status: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
