// import jwt from "jsonwebtoken";
// import Organizer from "../models/Organizer.js";

// // Organizer Login
// export const organizerLogin = async (req, res) => {
//   try {
//     const { name, password } = req.body;

//     if (!name || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Name and password are required",
//       });
//     }

//     // Find organizer by name
//     const organizer = await Organizer.findOne({ name });
//     if (!organizer) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Check if organizer is active
//     if (!organizer.isActive) {
//       return res.status(403).json({
//         success: false,
//         message: "Your account has been deactivated. Please contact admin.",
//       });
//     }

//     // Check password
//     const isPasswordValid = await organizer.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       { 
//         id: organizer._id, 
//         name: organizer.name, 
//         role: organizer.role 
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "24h" }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Organizer logged in successfully",
//       token,
//       organizer: {
//         id: organizer._id,
//         name: organizer.name,
//         role: organizer.role,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error during login",
//       error: error.message,
//     });
//   }
// };

// // Organizer Logout
// export const organizerLogout = async (req, res) => {
//   try {
//     res.status(200).json({
//       success: true,
//       message: "Organizer logged out successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error during logout",
//     });
//   }
// };

// // Get organizer profile
// export const getOrganizerProfile = async (req, res) => {
//   try {
//     const organizer = await Organizer.findById(req.user.id).select("-password");
//     if (!organizer) {
//       return res.status(404).json({
//         success: false,
//         message: "Organizer not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       organizer,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching profile",
//     });
//   }
// };








// controllers/organizerController.js
import Organizer from "../models/Organizer.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import jwt from "jsonwebtoken";
import { sendNotification } from "../services/notificationService.js";

// Organizer Login
export const organizerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const organizer = await Organizer.findOne({ email });
    if (!organizer) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if organizer is active
    if (!organizer.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    // Check if access has expired
    if (organizer.validTill && new Date() > organizer.validTill) {
      organizer.isActive = false;
      await organizer.save();
      return res.status(403).json({
        success: false,
        message: "Your organizer access has expired. Please contact admin.",
      });
    }

    const isPasswordValid = await organizer.comparePassword(password) || password === organizer.accessCode;
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    organizer.lastLogin = new Date();
    await organizer.save();

    const token = jwt.sign(
      { id: organizer._id, name: organizer.name, role: organizer.role, email: organizer.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      message: "Organizer logged in successfully",
      token,
      organizer: {
        id: organizer._id,
        name: organizer.name,
        email: organizer.email,
        role: organizer.role,
        assignedEvent: organizer.assignedEvent,
        permissions: organizer.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// Organizer Logout
export const organizerLogout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Organizer logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
};

// Get Organizer Profile
export const getOrganizerProfile = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id)
      .select("-password")
      .populate("assignedEvent", "eventName eventCode eventDate eventEndDate isActive");
    
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    res.status(200).json({
      success: true,
      organizer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

// Get Assigned Event Details
export const getAssignedEvent = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({
        success: false,
        message: "No event assigned to you",
      });
    }
    
    const event = await Event.findById(organizer.assignedEvent)
      .populate("participants", "username email profileImage dob phone")
      .populate("createdBy", "name email");
    
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

// Get Event Participants
export const getEventParticipants = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent)
      .populate("participants", "username email dob profileImage phone location addedPeopleCount");
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }
    
    res.status(200).json({
      success: true,
      participants: event.participants,
      count: event.participants.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add to organizerController.js
// Manually add a user to event (organizer)
export const manuallyAddUser = async (req, res) => {
  try {
    const { name, email, dob, bloodGroup, profession, location, gender, phone, socialMediaLink } = req.body;
    
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({
        success: false,
        message: "No event assigned"
      });
    }
    
    const event = await Event.findById(organizer.assignedEvent);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      user = new User({
        username: name,
        email: email,
        dob: new Date(dob),
        bloodGroup: bloodGroup || "",
        profession: profession || "",
        location: location || "",
        gender: gender || "",
        phone: phone || "",
        socialLinks: socialMediaLink ? { facebook: socialMediaLink } : {},
        joinedEvents: [],
      });
      await user.save();
    }
    
    // Add to event participants
    if (!event.participants.includes(user._id)) {
      event.participants.push(user._id);
      await event.save();
    }
    
    if (!user.joinedEvents.includes(event._id)) {
      user.joinedEvents.push(event._id);
      await user.save();
    }
    
    await sendNotification(
      user._id,
      "approval",
      "Added to Event",
      `You have been added to ${event.eventName} by an organizer.`,
      event._id
    );
    
    res.status(200).json({
      success: true,
      message: "User added successfully",
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update event approval mode (organizer)
export const updateEventApprovalModeOrganizer = async (req, res) => {
  try {
    const { approvalMode } = req.body;
    
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({
        success: false,
        message: "No event assigned"
      });
    }
    
    const event = await Event.findById(organizer.assignedEvent);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    event.approvalMode = approvalMode;
    await event.save();
    
    res.status(200).json({
      success: true,
      message: `Approval mode changed to ${approvalMode}`,
      approvalMode: event.approvalMode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getEventApprovalMode = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent).select("approvalMode");
    
    res.status(200).json({
      success: true,
      approvalMode: event.approvalMode,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Event Schedule
export const updateEventSchedule = async (req, res) => {
  try {
    const { schedule } = req.body;

    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }
    const event = await Event.findById(organizer.assignedEvent);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }
    
    event.schedule = schedule;
    await event.save();
    
    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      schedule: event.schedule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Pending Approvals
export const getPendingApprovals = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent)
      .populate("pendingApprovals", "username email dob profileImage phone location");

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.status(200).json({
      success: true,
      pendingApprovals: event.pendingApprovals,
      count: event.pendingApprovals.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve User
export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const pendingIdx = event.pendingApprovals.findIndex(id => id.toString() === userId);
    if (pendingIdx === -1) {
      return res.status(404).json({ success: false, message: "User not in pending approvals" });
    }

    event.pendingApprovals.splice(pendingIdx, 1);
    if (!event.participants.some(id => id.toString() === userId)) {
      event.participants.push(userId);
    }
    await event.save();

    await User.findByIdAndUpdate(userId, { $addToSet: { joinedEvents: event._id } });

    await sendNotification(userId, "approval", "Join Request Approved",
      `Your request to join "${event.eventName}" has been approved!`, event._id);

    res.status(200).json({ success: true, message: "User approved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject User
export const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    event.pendingApprovals = event.pendingApprovals.filter(id => id.toString() !== userId);
    await event.save();

    await sendNotification(userId, "approval", "Join Request Not Approved",
      `Your request to join "${event.eventName}" was not approved.`, event._id);

    res.status(200).json({ success: true, message: "User rejected successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Unvalidated Relationships
export const getUnvalidatedRelationships = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const relationships = await Relationship.find({
      eventId: organizer.assignedEvent,
      isValidated: false,
    })
      .populate("person1", "username email")
      .populate("person2", "username email")
      .populate("addedBy", "username email");

    res.status(200).json({
      success: true,
      relationships,
      count: relationships.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Validate or Invalidate a Relationship
export const validateRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { isValidated } = req.body;

    const organizer = await Organizer.findById(req.user.id);
    const relationship = await Relationship.findById(id);

    if (!relationship) {
      return res.status(404).json({ success: false, message: "Relationship not found" });
    }

    if (organizer.assignedEvent && relationship.eventId.toString() !== organizer.assignedEvent.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to moderate this relationship" });
    }

    relationship.isValidated = isValidated !== undefined ? isValidated : true;
    await relationship.save();

    res.status(200).json({
      success: true,
      message: `Relationship ${relationship.isValidated ? "validated" : "invalidated"} successfully`,
      relationship,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Organizer Stats
export const getOrganizerStats = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    if (!organizer || !organizer.assignedEvent) {
      return res.status(404).json({ success: false, message: "No event assigned" });
    }

    const event = await Event.findById(organizer.assignedEvent);
    const relationshipsCount = await Relationship.countDocuments({ 
      eventId: organizer.assignedEvent 
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalParticipants: event?.participants.length || 0,
        totalRelationships: relationshipsCount,
        eventActive: event?.isActive || false,
        eventDate: event?.eventDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};