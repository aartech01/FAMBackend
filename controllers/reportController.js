// controllers/reportController.js
import Report from "../models/Report.js";
import Event from "../models/Event.js";
import { createLog } from "../services/auditService.js";

// Submit a report (any event participant)
export const submitReport = async (req, res) => {
  try {
    const { eventId, reportedUser, reportedRelationship, reason, description } = req.body;
    const reportedBy = req.user.id;

    if (!eventId || !reason) {
      return res.status(400).json({ success: false, message: "eventId and reason are required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Regular users must be participants
    if (req.user.role === "user") {
      const isMember = event.participants.some(p => p.toString() === reportedBy.toString());
      if (!isMember) {
        return res.status(403).json({ success: false, message: "You must be a participant to submit a report" });
      }
    }

    const report = new Report({
      reportedBy,
      eventId,
      reportedUser: reportedUser || null,
      reportedRelationship: reportedRelationship || null,
      reason,
      description: description || "",
    });

    await report.save();

    await createLog({
      userId: req.user.id,
      role: req.user.role,
      action: "SUBMIT_REPORT",
      module: "moderation",
      metadata: { reportId: report._id, eventId, reason },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Get all reports (admin only, paginated with status filter)
export const getAllReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("reportedBy", "username email")
        .populate("reportedUser", "username email")
        .populate("eventId", "eventName eventCode")
        .populate("reviewedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      reports,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Review a report (admin only)
export const reviewReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    const validStatuses = ["reviewed", "dismissed", "actioned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    report.status = status;
    report.reviewedBy = req.user.id;
    report.reviewNote = reviewNote || "";
    report.reviewedAt = new Date();
    await report.save();

    await createLog({
      userId: req.user.id,
      role: req.user.role,
      action: "REVIEW_REPORT",
      module: "moderation",
      metadata: { reportId: id, status, reviewNote },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Report reviewed successfully",
      report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get reports for a specific event (organizer/admin)
export const getReportsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const query = { eventId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("reportedBy", "username email")
        .populate("reportedUser", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      reports,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
