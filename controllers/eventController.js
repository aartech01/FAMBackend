// controllers/eventController.js
// Event creation is handled by POST /api/admin/events (adminController.js)
import Event from "../models/Event.js";
import User from "../models/User.js";
import { createLog } from "../services/auditService.js";
import { generateEventQRCode } from "../services/qrService.js";

// Join event (User — requires authentication)
export const joinEvent = async (req, res) => {
  try {
    const { eventCode } = req.body;

    if (!eventCode) {
      return res.status(400).json({ success: false, message: "eventCode is required" });
    }

    const normalizedCode = String(eventCode).trim().toLowerCase();

    // Find event by code
    const event = await Event.findOne({ eventCode: normalizedCode });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (!event.isActive) {
      return res.status(400).json({ success: false, message: "Event is no longer active" });
    }

    // Use the authenticated user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if already a participant or pending
    const alreadyParticipant = event.participants.some(p => p.toString() === user._id.toString());
    const alreadyPending = event.pendingApprovals.some(p => p.toString() === user._id.toString());
    if (alreadyParticipant || alreadyPending) {
      return res.status(400).json({
        success: false,
        message: alreadyParticipant ? "You have already joined this event" : "Your join request is already pending approval",
      });
    }

    // Route user based on approvalMode
    if (event.approvalMode === "auto") {
      event.participants.push(user._id);
      if (!user.joinedEvents.some(e => e.toString() === event._id.toString())) {
        user.joinedEvents.push(event._id);
      }
    } else {
      event.pendingApprovals.push(user._id);
    }

    await user.save();
    await event.save();
    
    // Create log
    await createLog({
      userId: user._id,
      role: "user",
      action: "JOIN_EVENT",
      module: "event",
      metadata: { eventId: event._id, eventCode },
      ipAddress: req.ip,
    });
    
    res.status(200).json({
      success: true,
      message: event.approvalMode === "manual" ? "Join request sent for approval" : "Successfully joined event",
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        qrCode: event.qrCodeImage,
      },
      user,
      requiresApproval: event.approvalMode === "manual",
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Validate event code
export const validateEventCode = async (req, res) => {
  try {
    const { eventCode } = req.body;

    if (!eventCode) {
      return res.status(400).json({ success: false, message: "eventCode is required" });
    }

    const normalizedCode = String(eventCode).trim().toLowerCase();
    const event = await Event.findOne({ eventCode: normalizedCode });
    
    if (!event) {
      return res.status(404).json({ success: false, message: "Invalid event code" });
    }
    
    if (!event.isActive) {
      return res.status(400).json({ success: false, message: "Event is no longer active" });
    }
    
    res.status(200).json({
      success: true,
      message: "Event code is valid",
      event: {
        id: event._id,
        name: event.eventName,
        description: event.description,
        eventDate: event.eventDate,
        requiresApproval: event.approvalMode === "manual",
      },
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event details
export const getEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id)
      .populate("createdBy", "name email")
      .populate("organizers", "name email isActive")
      .populate("participants", "username email profileImage");
    
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    
    res.status(200).json({
      success: true,
      event,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event QR code
export const getEventQR = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Regenerate with brand colors so all events (including old ones) get the styled QR
    const qrDataUrl = await generateEventQRCode(event._id, event.eventCode, event.eventName);

    res.status(200).json({
      success: true,
      qrCode: qrDataUrl,
      eventCode: event.eventCode,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all events
export const getAllEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find()
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      events,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event participants (paginated, searchable — participants/org/admin only)
export const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { search, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const role = req.user.role;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (role === "user") {
      const isMember = event.participants.some(p => p.toString() === userId.toString());
      if (!isMember) {
        return res.status(403).json({ success: false, message: "You must be a participant to view the participant list" });
      }
    }

    const query = { _id: { $in: event.participants } };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [participants, total] = await Promise.all([
      User.find(query)
        .select("username email profileImage gender")
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      participants,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update event
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    
    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    
    const allowed = ['eventName', 'eventDate', 'eventEndDate', 'description', 'location',
                      'approvalMode', 'isActive', 'treeType', 'schedule', 'groomName', 'brideName'];
    for (const key of allowed) {
      if (key in updateData) event[key] = updateData[key];
    }
    await event.save();
    
    await createLog({
      userId: req.user.id,
      role: "admin",
      action: "UPDATE_EVENT",
      module: "event",
      metadata: { eventId: id, updates: Object.keys(updateData) },
      ipAddress: req.ip,
    });
    
    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};