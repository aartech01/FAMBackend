// import jwt from "jsonwebtoken";
// import Admin from "../models/Admin.js";
// import Organizer from "../models/Organizer.js";

// // Admin Login
// export const adminLogin = async (req, res) => {
//   try {
//     const { name, password } = req.body;

//     if (!name || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Name and password are required",
//       });
//     }

//     // Find admin by name
//     const admin = await Admin.findOne({ name });
//     if (!admin) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Check password
//     const isPasswordValid = await admin.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       {
//         id: admin._id,
//         name: admin.name,
//         role: admin.role
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "24h" }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Admin logged in successfully",
//       token,
//       admin: {
//         id: admin._id,
//         name: admin.name,
//         role: admin.role,
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

// // Admin Logout
// export const adminLogout = async (req, res) => {
//   try {
//     // Since we're using JWT, logout is handled client-side by removing the token
//     res.status(200).json({
//       success: true,
//       message: "Admin logged out successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error during logout",
//     });
//   }
// };

// // Get all organizers
// export const getAllOrganizers = async (req, res) => {
//   try {
//     const organizers = await Organizer.find({}, "-password");
//     res.status(200).json({
//       success: true,
//       count: organizers.length,
//       organizers,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching organizers",
//       error: error.message,
//     });
//   }
// };

// // Remove organizer (soft delete - deactivate)
// export const removeOrganizer = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const organizer = await Organizer.findById(id);
//     if (!organizer) {
//       return res.status(404).json({
//         success: false,
//         message: "Organizer not found",
//       });
//     }

//     // Soft delete - set isActive to false
//     organizer.isActive = false;
//     await organizer.save();

//     res.status(200).json({
//       success: true,
//       message: "Organizer removed successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error removing organizer",
//       error: error.message,
//     });
//   }
// };

// // Reactivate organizer
// export const reactivateOrganizer = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const organizer = await Organizer.findById(id);
//     if (!organizer) {
//       return res.status(404).json({
//         success: false,
//         message: "Organizer not found",
//       });
//     }

//     organizer.isActive = true;
//     await organizer.save();

//     res.status(200).json({
//       success: true,
//       message: "Organizer reactivated successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error reactivating organizer",
//       error: error.message,
//     });
//   }
// };

// // Get admin profile
// export const getAdminProfile = async (req, res) => {
//   try {
//     const admin = await Admin.findById(req.user.id).select("-password");
//     if (!admin) {
//       return res.status(404).json({
//         success: false,
//         message: "Admin not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       admin,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching profile",
//     });
//   }
// };










// controllers/adminController.js
import Admin from "../models/Admin.js";
import Organizer from "../models/Organizer.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Log from "../models/Log.js";
import Relationship from "../models/Relationship.js";
import jwt from "jsonwebtoken";
import { generateEventQRCode, uploadQRToCloudinary } from "../services/qrService.js";
import { createLog } from "../services/auditService.js";
import { sendNotification } from "../services/notificationService.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { sendOrganizerCredentials } from "../services/emailService.js";
import mongoose from "mongoose"

// Generate a unique event code with retry on collision
const generateUniqueEventCode = async (eventName) => {
  const base = eventName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  for (let i = 0; i < 10; i++) {
    const code = `${base}${Math.floor(Math.random() * 9000) + 1000}`;
    const exists = await Event.findOne({ eventCode: code });
    if (!exists) return code;
  }
  return `${base}${Date.now().toString(36)}`;
};

export const adminLogin = async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: "Name and password are required",
      });
    }

    const admin = await Admin.findOne({ name });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, name: admin.name, role: admin.role, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// Admin Logout
export const adminLogout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
};

// Get Admin Profile
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-password");
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

// Create Organizer
export const createOrganizer = async (req, res) => {
  try {
    const { name, email, assignedEvent, validTill } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Check if organizer already exists
    const existingOrganizer = await Organizer.findOne({ email });
    if (existingOrganizer) {
      return res.status(400).json({
        success: false,
        message: "Organizer with this email already exists",
      });
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const accessCode = Math.random().toString(36).slice(-6).toUpperCase();

    const organizer = new Organizer({
      name,
      email,
      password: tempPassword,
      assignedEvent: assignedEvent || null,
      assignedEvents: assignedEvent ? [assignedEvent] : [],
      accessCode,
      isActive: true,
      validTill: validTill || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      createdBy: req.user.id,
      permissions: [
        "moderate_tree",
        "approve_users",
        "manage_schedule",
        "view_participants",
      ],
    });

    await organizer.save();

    // Send credentials email (non-fatal)
    sendOrganizerCredentials(email, name, tempPassword, accessCode, assignedEvent ? 'your assigned event' : 'FAM')
      .catch((err) => console.error('Organizer credentials email failed (non-fatal):', err.message));

    res.status(201).json({
      success: true,
      message: "Organizer created successfully",
      organizer: {
        id: organizer._id,
        name: organizer.name,
        email: organizer.email,
        accessCode: organizer.accessCode,
        tempPassword,
        assignedEvent: organizer.assignedEvent,
        validTill: organizer.validTill,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Organizers
export const getAllOrganizers = async (req, res) => {
  try {
    const organizers = await Organizer.find({}, "-password")
      .populate("assignedEvent", "eventName eventCode")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      count: organizers.length,
      organizers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching organizers",
      error: error.message,
    });
  }
};

// Get Single Organizer
export const getOrganizerById = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await Organizer.findById(id, "-password")
      .populate("assignedEvent", "eventName eventCode eventDate isActive")
      .populate("createdBy", "name email");

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
      message: error.message,
    });
  }
};

// Update Organizer
export const updateOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, assignedEvent, validTill, isActive } = req.body;

    const organizer = await Organizer.findById(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    if (name) organizer.name = name;
    if (email) organizer.email = email;
    if (assignedEvent !== undefined) organizer.assignedEvent = assignedEvent;
    if (validTill) organizer.validTill = validTill;
    if (isActive !== undefined) organizer.isActive = isActive;

    await organizer.save();

    res.status(200).json({
      success: true,
      message: "Organizer updated successfully",
      organizer: {
        id: organizer._id,
        name: organizer.name,
        email: organizer.email,
        assignedEvent: organizer.assignedEvent,
        validTill: organizer.validTill,
        isActive: organizer.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove Organizer (Soft Delete)
export const removeOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await Organizer.findById(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    organizer.isActive = false;
    await organizer.save();

    res.status(200).json({
      success: true,
      message: "Organizer removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing organizer",
      error: error.message,
    });
  }
};

// Reactivate Organizer
export const reactivateOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await Organizer.findById(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    organizer.isActive = true;
    await organizer.save();

    res.status(200).json({
      success: true,
      message: "Organizer reactivated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error reactivating organizer",
      error: error.message,
    });
  }
};

// Get All Users (Admin)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, "-otp -otpExpiry -refreshToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/adminController.js - Add this function

// Get all users from a specific event by event ID
export const getEventUsers = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Find the event with populated participants
    const event = await Event.findById(eventId)
      .populate("participants", "username email dob profileImage phone location bloodGroup profession gender addedPeopleCount createdAt")
      .populate("pendingApprovals", "username email dob profileImage phone location bloodGroup profession gender")
      .populate("organizers", "name email isActive");
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    // Get additional stats
    const totalParticipants = event.participants.length;
    const totalPending = event.pendingApprovals?.length || 0;
    const totalOrganizers = event.organizers.length;
    
    // Get relationship count for this event
    const totalRelationships = await Relationship.countDocuments({
      eventId: eventId,
      isValidated: true
    });

    // Get user addition stats (who added how many people)
    const userAdditionStats = await Relationship.aggregate([
      { $match: { eventId: mongoose.Types.ObjectId ? new mongoose.Types.ObjectId(eventId) : eventId } },
      { $group: { _id: "$addedBy", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).catch(() => []);
    
    // Populate user details for addition stats
    const topContributors = [];
    for (const stat of userAdditionStats) {
      const user = await User.findById(stat._id).select("username email profileImage");
      if (user) {
        topContributors.push({
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage
          },
          peopleAdded: stat.count
        });
      }
    }
    
    res.status(200).json({
      success: true,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        description: event.description,
        eventType: event.eventType,
        approvalMode: event.approvalMode,
        isActive: event.isActive,
        createdAt: event.createdAt,
      },
      statistics: {
        totalParticipants,
        totalPending,
        totalOrganizers,
        totalRelationships,
        maxMembersPerUser: event.settings?.maxMembersPerUser || 4,
      },
      participants: event.participants.map(participant => ({
        id: participant._id,
        username: participant.username,
        email: participant.email,
        dob: participant.dob,
        profileImage: participant.profileImage,
        phone: participant.phone,
        location: participant.location,
        bloodGroup: participant.bloodGroup,
        profession: participant.profession,
        gender: participant.gender,
        addedPeopleCount: participant.addedPeopleCount,
        joinedAt: participant.createdAt,
        canAddMore: participant.addedPeopleCount < 4
      })),
      pendingApprovals: event.pendingApprovals.filter(Boolean).map(pending => ({
        id: pending._id,
        username: pending.username,
        email: pending.email,
        dob: pending.dob,
        profileImage: pending.profileImage,
        phone: pending.phone,
        location: pending.location,
        requestedAt: pending.createdAt
      })),
      organizers: event.organizers.map(organizer => ({
        id: organizer._id,
        name: organizer.name,
        email: organizer.email,
        isActive: organizer.isActive
      })),
      topContributors
    });
    
  } catch (error) {
    console.error("Get event users error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all events with user counts (summary)
export const getAllEventsWithUserCounts = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const participantCount = await User.countDocuments({ 
        joinedEvents: event._id 
      });
      
      const pendingCount = event.pendingApprovals?.length || 0;
      const organizerCount = event.organizers?.length || 0;
      
      const relationshipsCount = await Relationship.countDocuments({
        eventId: event._id,
        isValidated: true
      });
      
      return {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        eventType: event.eventType,
        approvalMode: event.approvalMode,
        isActive: event.isActive,
        createdAt: event.createdAt,
        createdBy: event.createdBy,
        statistics: {
          participants: participantCount,
          pendingApprovals: pendingCount,
          organizers: organizerCount,
          relationships: relationshipsCount
        }
      };
    }));
    
    res.status(200).json({
      success: true,
      totalEvents: eventsWithCounts.length,
      events: eventsWithCounts
    });
    
  } catch (error) {
    console.error("Get events with counts error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user details within an event (specific user)
export const getEventUserDetails = async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    // Get user
    const user = await User.findById(userId)
      .select("-otp -otpExpiry -refreshToken");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Check if user is part of the event
    const isParticipant = event.participants.some(id => id.toString() === userId);
    const isPending = event.pendingApprovals?.some(id => id.toString() === userId);
    const isOrganizer = event.organizers.some(id => id.toString() === userId);
    
    if (!isParticipant && !isPending && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: "User is not associated with this event"
      });
    }
    
    // Get user's relationships in this event
    const relationships = await Relationship.find({
      eventId: eventId,
      $or: [
        { person1: userId },
        { person2: userId }
      ]
    }).populate("person1 person2", "username email profileImage");
    
    // Get user's added people count in this event
    const addedCount = await Relationship.countDocuments({
      eventId: eventId,
      addedBy: userId
    });
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        dob: user.dob,
        profileImage: user.profileImage,
        phone: user.phone,
        location: user.location,
        bloodGroup: user.bloodGroup,
        profession: user.profession,
        gender: user.gender,
        socialLinks: user.socialLinks,
        addedPeopleCount: user.addedPeopleCount,
        addedInThisEvent: addedCount,
        isDeceased: user.isDeceased,
        deathYear: user.deathYear,
        joinedAt: user.createdAt,
        status: isParticipant ? "approved" : (isPending ? "pending" : "organizer")
      },
      relationships: relationships.map(rel => ({
        id: rel._id,
        relationType: rel.relationType,
        familySide: rel.familySide,
        isValidated: rel.isValidated,
        with: rel.person1._id.toString() === userId ? rel.person2 : rel.person1,
        createdAt: rel.createdAt
      })),
      statistics: {
        totalRelationships: relationships.length,
        validatedRelationships: relationships.filter(r => r.isValidated).length,
        pendingValidations: relationships.filter(r => !r.isValidated).length
      }
    });
    
  } catch (error) {
    console.error("Get event user details error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Block User
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isBlocked = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/adminController.js - Add this function

// Get all blocked users
export const getBlockedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { isBlocked: true };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get blocked users with pagination
    const [blockedUsers, total] = await Promise.all([
      User.find(query)
        .select("-otp -otpExpiry -refreshToken")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("joinedEvents", "eventName eventCode eventDate"),
      User.countDocuments(query)
    ]);
    
    // Get additional statistics
    const totalBlocked = total;
    const blockedByDate = await User.aggregate([
      { $match: { isBlocked: true } },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
            day: { $dayOfMonth: "$updatedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
      { $limit: 30 }
    ]);
    
    // Get blocked users with their event participation
    const blockedUsersWithEvents = await Promise.all(blockedUsers.map(async (user) => {
      const eventsCount = user.joinedEvents?.length || 0;
      const relationshipsCount = await Relationship.countDocuments({
        $or: [
          { person1: user._id },
          { person2: user._id }
        ]
      });
      
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone,
        location: user.location,
        bloodGroup: user.bloodGroup,
        gender: user.gender,
        isBlocked: user.isBlocked,
        blockedAt: user.updatedAt,
        joinedEvents: user.joinedEvents,
        eventsCount,
        relationshipsCount,
        addedPeopleCount: user.addedPeopleCount,
        createdAt: user.createdAt
      };
    }));
    
    res.status(200).json({
      success: true,
      statistics: {
        totalBlocked,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      blockedByDate: blockedByDate.map(item => ({
        date: `${item._id.year}-${item._id.month}-${item._id.day}`,
        count: item.count
      })),
      blockedUsers: blockedUsersWithEvents
    });
    
  } catch (error) {
    console.error("Get blocked users error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get blocked user details by ID
export const getBlockedUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find the blocked user
    const user = await User.findById(userId)
      .select("-otp -otpExpiry -refreshToken")
      .populate("joinedEvents", "eventName eventCode eventDate eventType isActive");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    if (!user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "User is not blocked"
      });
    }
    
    // Get user's relationships
    const relationships = await Relationship.find({
      $or: [
        { person1: userId },
        { person2: userId }
      ]
    })
      .populate("person1", "username email profileImage")
      .populate("person2", "username email profileImage")
      .populate("eventId", "eventName eventCode");
    
    // Get user's activity logs (blocked related)
    const logs = await Log.find({ 
      userId: userId,
      action: { $in: ["BLOCK_USER", "UNBLOCK_USER"] }
    })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get events where user is participant
    const events = await Event.find({
      participants: userId
    }).select("eventName eventCode eventDate isActive");
    
    // Get pending approvals if any
    const pendingEvents = await Event.find({
      pendingApprovals: userId
    }).select("eventName eventCode eventDate");
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone,
        location: user.location,
        bloodGroup: user.bloodGroup,
        profession: user.profession,
        gender: user.gender,
        dob: user.dob,
        isBlocked: user.isBlocked,
        blockedAt: user.updatedAt,
        addedPeopleCount: user.addedPeopleCount,
        createdAt: user.createdAt,
        socialLinks: user.socialLinks
      },
      statistics: {
        totalRelationships: relationships.length,
        totalEventsJoined: events.length,
        totalPendingApprovals: pendingEvents.length,
        addedPeopleCount: user.addedPeopleCount
      },
      relationships: relationships.map(rel => ({
        id: rel._id,
        relationType: rel.relationType,
        familySide: rel.familySide,
        isValidated: rel.isValidated,
        event: rel.eventId,
        person1: rel.person1,
        person2: rel.person2,
        createdAt: rel.createdAt
      })),
      joinedEvents: events,
      pendingEvents,
      activityLogs: logs.map(log => ({
        action: log.action,
        performedBy: log.userId,
        timestamp: log.createdAt,
        ipAddress: log.ipAddress
      }))
    });
    
  } catch (error) {
    console.error("Get blocked user details error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get blocked users summary (dashboard)
export const getBlockedUsersSummary = async (req, res) => {
  try {
    // Get total counts
    const totalBlocked = await User.countDocuments({ isBlocked: true });
    const totalUsers = await User.countDocuments();
    const blockedPercentage = totalUsers > 0 ? ((totalBlocked / totalUsers) * 100).toFixed(2) : 0;
    
    // Get blocked users by role (only user role can be blocked)
    const blockedByRole = await User.aggregate([
      { $match: { isBlocked: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);
    
    // Get blocked users by month (last 6 months)
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const count = await User.countDocuments({
        isBlocked: true,
        updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
      });
      
      last6Months.push({
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear(),
        count
      });
    }
    
    // Get recent blocked users (last 10)
    const recentBlocked = await User.find({ isBlocked: true })
      .select("username email profileImage updatedAt")
      .sort({ updatedAt: -1 })
      .limit(10);
    
    // Get most active blocked users (who added most relationships)
    const mostActiveBlocked = await Relationship.aggregate([
      { $match: { isValidated: true } },
      { $group: { _id: "$addedBy", relationshipCount: { $sum: 1 } } },
      { $sort: { relationshipCount: -1 } },
      { $limit: 10 }
    ]);
    
    // Populate user details for most active
    const activeBlockedUsers = [];
    for (const item of mostActiveBlocked) {
      const user = await User.findOne({ _id: item._id, isBlocked: true })
        .select("username email profileImage");
      if (user) {
        activeBlockedUsers.push({
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage
          },
          relationshipsAdded: item.relationshipCount
        });
      }
    }
    
    res.status(200).json({
      success: true,
      summary: {
        totalBlocked,
        totalUsers,
        blockedPercentage: parseFloat(blockedPercentage),
        blockedByRole: blockedByRole.map(item => ({
          role: item._id || "user",
          count: item.count
        }))
      },
      monthlyTrend: last6Months,
      recentBlocked: recentBlocked.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        blockedAt: user.updatedAt
      })),
      mostActiveBlocked: activeBlockedUsers
    });
    
  } catch (error) {
    console.error("Get blocked users summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Unblock multiple users (bulk operation)
export const unblockAllUsers = async (req, res) => {
  try {
    // Get count of blocked users before unblocking
    const blockedCount = await User.countDocuments({ isBlocked: true });
    
    if (blockedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No blocked users found to unblock"
      });
    }
    
    // Unblock all users
    const result = await User.updateMany(
      { isBlocked: true },
      { $set: { isBlocked: false, updatedAt: new Date() } }
    );
    
    // Create log
    await createLog({
      userId: req.user.id,
      role: "admin",
      action: "UNBLOCK_ALL_USERS",
      module: "user",
      metadata: { unblockedCount: result.modifiedCount },
      ipAddress: req.ip,
    });
    
    res.status(200).json({
      success: true,
      message: `Successfully unblocked all ${result.modifiedCount} blocked user(s)`,
      unblockedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error("Unblock all users error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Unblock User
export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isBlocked = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== NEW FUNCTIONS (ADDED BELOW) ====================

// Create Event (Admin only)
export const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      description,
      eventType,
      eventDate,
      eventEndDate,
      organizerEmail,
      organizerName,
      settings,
      approvalMode, // 'auto' or 'manual'
      groomName,
      brideName,
      mainPersonName,
      groomImage,
      brideImage,
      mainPersonImage,
    } = req.body;

    // Upload a base64 data-URL image to Cloudinary; fall back to base64 storage if Cloudinary fails
    const uploadAnchorImage = async (base64DataUrl) => {
      if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) return null;
      try {
        const buf = Buffer.from(base64DataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        return await uploadBufferToCloudinary(buf, { folder: 'fam/anchors' });
      } catch (err) {
        console.error('Cloudinary upload failed, storing base64 directly:', err.message);
        return base64DataUrl;
      }
    };

    if (!eventName || !eventDate || !organizerEmail || !organizerName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const eventCode = await generateUniqueEventCode(eventName);

    const isWeddingType = eventType === "wedding" || eventType === "anniversary";
    const event = new Event({
      eventName,
      eventCode,
      description,
      eventType: eventType || "other",
      eventDate,
      eventEndDate,
      createdBy: req.user.id,
      settings: settings || { approvalRequired: false, maxMembersPerUser: 4 },
      approvalMode: approvalMode || "manual",
      isActive: true,
      pendingApprovals: [],
      treeType: isWeddingType ? "wedding" : "common",
      ...(isWeddingType ? { groomName, brideName } : { mainPersonName }),
    });

    await event.save();

    // Generate QR code and store Cloudinary URL (not base64)
    const qrDataURL = await generateEventQRCode(event._id, event.eventCode, event.eventName);
    event.qrCodeImage = await uploadQRToCloudinary(qrDataURL, event._id);
    await event.save();

    // Find-or-create organizer — reuse existing account if the email is already registered
    let organizer = await Organizer.findOne({ email: organizerEmail });
    let tempPassword = null;
    let isExistingOrganizer = false;

    if (organizer) {
      // Existing organizer: assign this event to them without changing their password
      isExistingOrganizer = true;
      organizer.assignedEvent = event._id;
      if (!organizer.assignedEvents) organizer.assignedEvents = [];
      if (!organizer.assignedEvents.some(e => e.toString() === event._id.toString())) {
        organizer.assignedEvents.push(event._id);
      }
      organizer.isActive = true;
      // Extend validity if this event's end date is later
      const newExpiry = eventEndDate
        ? new Date(eventEndDate)
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      if (!organizer.validTill || newExpiry > organizer.validTill) {
        organizer.validTill = newExpiry;
      }
      await organizer.save();
    } else {
      // New organizer — create with a temp password
      tempPassword = Math.random().toString(36).slice(-8);
      organizer = new Organizer({
        name: organizerName,
        email: organizerEmail,
        password: tempPassword,
        assignedEvent: event._id,
        assignedEvents: [event._id],
        accessCode: Math.random().toString(36).slice(-6).toUpperCase(),
        isActive: true,
        validTill: eventEndDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdBy: req.user.id,
        permissions: ["moderate_tree", "approve_users", "manage_schedule", "view_participants"],
      });
      await organizer.save();
    }

    event.organizers.push(organizer._id);
    await event.save();

    // Create placeholder user accounts for tree anchors so nodes appear immediately
    const makePlaceholder = async (name, tag) => {
      const plEmail = `${tag}_${eventCode.toLowerCase()}@placeholder.fam`;
      let u = await User.findOne({ email: plEmail });
      if (!u) {
        u = new User({ username: name, email: plEmail, dob: new Date('1990-01-01'), isTemporary: true });
        await u.save();
      }
      await User.findByIdAndUpdate(u._id, { $addToSet: { joinedEvents: event._id } });
      if (!event.participants.some(p => p.toString() === u._id.toString())) {
        event.participants.push(u._id);
      }
      return u;
    };

    try {
      const RelModel = Relationship;
      if (isWeddingType && groomName && brideName) {
        const groomUser = await makePlaceholder(groomName, 'groom');
        const brideUser = await makePlaceholder(brideName, 'bride');
        // Attach uploaded profile photos to the placeholder accounts
        const [groomImgUrl, brideImgUrl] = await Promise.all([
          uploadAnchorImage(groomImage),
          uploadAnchorImage(brideImage),
        ]);
        if (groomImgUrl) await User.findByIdAndUpdate(groomUser._id, { profileImage: groomImgUrl });
        if (brideImgUrl) await User.findByIdAndUpdate(brideUser._id, { profileImage: brideImgUrl });
        event.treeConfig = { groomId: groomUser._id, brideId: brideUser._id };
        await event.save();
        const exists = await RelModel.findOne({ eventId: event._id, person1: groomUser._id, person2: brideUser._id });
        if (!exists) {
          await RelModel.create({
            eventId: event._id, addedBy: req.user.id,
            person1: groomUser._id, person2: brideUser._id,
            relationType: 'spouse', familySide: 'common',
            isValidated: true, createdBy: req.user.id,
          });
        }
      } else if (!isWeddingType && mainPersonName) {
        const mainUser = await makePlaceholder(mainPersonName, 'main');
        const mainImgUrl = await uploadAnchorImage(mainPersonImage);
        if (mainImgUrl) await User.findByIdAndUpdate(mainUser._id, { profileImage: mainImgUrl });
        event.treeConfig = { mainPersonId: mainUser._id };
        await event.save();
      }
    } catch (anchorErr) {
      console.error('Anchor placeholder creation error (non-fatal):', anchorErr.message);
    }

    // Send credentials email to organizer (only for newly created organizers)
    if (!isExistingOrganizer && tempPassword) {
      sendOrganizerCredentials(organizer.email, organizer.name, tempPassword, organizer.accessCode, event.eventName)
        .catch((err) => console.error('Organizer credentials email failed (non-fatal):', err.message));
    }

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        qrCode: event.qrCodeImage,
        eventDate: event.eventDate,
        approvalMode: event.approvalMode,
      },
      organizer: {
        id: organizer._id,
        name: organizer.name,
        email: organizer.email,
        isExistingOrganizer,
        // tempPassword is null for existing organizers (their password is unchanged)
        tempPassword: isExistingOrganizer ? null : tempPassword,
        accessCode: organizer.accessCode,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/adminController.js - Add this function

// Get event by ID or event code
export const getEventByIdOrCode = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let event;
    let isCode = false;
    
    // Check if identifier starts with '#' (event code) or is a valid ObjectId
    if (identifier.startsWith('#') || !mongoose.Types.ObjectId.isValid(identifier)) {
      // Search by event code
      event = await Event.findOne({ eventCode: identifier });
      isCode = true;
    } else {
      // Search by event ID (MongoDB ObjectId)
      try {
        event = await Event.findById(identifier);
      } catch (err) {
        // If invalid ObjectId format, try as event code
        event = await Event.findOne({ eventCode: identifier });
        isCode = true;
      }
    }
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: `Event not found with ${isCode ? 'code' : 'ID'}: ${identifier}`
      });
    }
    
    // Get populated data
    await event.populate("createdBy", "name email");
    await event.populate("organizers", "name email isActive validTill");
    await event.populate("participants", "username email profileImage dob addedPeopleCount");
    
    // Get additional statistics
    const totalRelationships = await Relationship.countDocuments({
      eventId: event._id,
      isValidated: true
    });

    const pendingRelationships = await Relationship.countDocuments({
      eventId: event._id,
      isValidated: false
    });
    
    const totalParticipants = event.participants.length;
    const totalPendingApprovals = event.pendingApprovals?.length || 0;
    const totalOrganizers = event.organizers.length;
    
    // Get participant addition statistics
    const participantJoins = event.participants.map(p => ({
      id: p._id,
      username: p.username,
      email: p.email,
      profileImage: p.profileImage,
      joinedAt: p.createdAt
    }));
    
    // Get user contribution stats (who added how many relationships)
    const topContributors = await Relationship.aggregate([
      { $match: { eventId: event._id, isValidated: true } },
      { $group: { _id: "$addedBy", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Populate contributor details
    const contributors = [];
    for (const contributor of topContributors) {
      const user = await User.findById(contributor._id).select("username email profileImage");
      if (user) {
        contributors.push({
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage
          },
          relationshipsAdded: contributor.count
        });
      }
    }
    
    // Get recent activity (last 10 relationships added)
    const recentActivity = await Relationship.find({
      eventId: event._id 
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("addedBy", "username email profileImage")
      .populate("person1", "username")
      .populate("person2", "username");
    
    const formattedActivity = recentActivity.map(activity => ({
      id: activity._id,
      action: "ADD_RELATIONSHIP",
      relationType: activity.relationType,
      familySide: activity.familySide,
      addedBy: activity.addedBy,
      person1: activity.person1,
      person2: activity.person2,
      isValidated: activity.isValidated,
      createdAt: activity.createdAt
    }));
    
    // Check event status
    const now = new Date();
    const eventStatus = {
      isUpcoming: event.eventDate > now,
      isOngoing: event.eventDate <= now && (!event.eventEndDate || event.eventEndDate >= now),
      isCompleted: event.eventEndDate ? event.eventEndDate < now : false,
      isActive: event.isActive
    };
    
    // Get tree type specific info
    let treeInfo = {};
    if (event.treeType === "common" && event.treeConfig?.mainPersonId) {
      const mainPerson = await User.findById(event.treeConfig.mainPersonId).select("username email profileImage");
      treeInfo = {
        type: "common",
        mainPerson: mainPerson ? {
          id: mainPerson._id,
          username: mainPerson.username,
          email: mainPerson.email,
          profileImage: mainPerson.profileImage
        } : null
      };
    } else if ((event.treeType === "wedding" || event.treeType === "anniversary") && event.treeConfig) {
      const groom = event.treeConfig.groomId
        ? await User.findById(event.treeConfig.groomId).select("username email profileImage")
        : null;
      const bride = event.treeConfig.brideId
        ? await User.findById(event.treeConfig.brideId).select("username email profileImage")
        : null;
      treeInfo = {
        type: event.treeType,
        groom: groom ? {
          id: groom._id,
          username: groom.username,
          email: groom.email,
          profileImage: groom.profileImage
        } : null,
        bride: bride ? {
          id: bride._id,
          username: bride.username,
          email: bride.email,
          profileImage: bride.profileImage
        } : null
      };
    }
    
    res.status(200).json({
      success: true,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        description: event.description,
        eventType: event.eventType,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        qrCode: event.qrCodeImage,
        schedule: event.schedule,
        settings: event.settings,
        approvalMode: event.approvalMode,
        treeType: event.treeType,
        treeConfig: event.treeConfig,
        groomName: event.groomName || null,
        brideName: event.brideName || null,
        mainPersonName: event.mainPersonName || null,
        isActive: event.isActive,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        createdBy: event.createdBy,
        eventStatus,
        treeInfo
      },
      statistics: {
        totalParticipants,
        totalPendingApprovals,
        totalOrganizers,
        totalRelationships,
        pendingRelationships,
        validatedRelationships: totalRelationships - pendingRelationships,
        participantLimit: event.settings?.maxMembersPerUser || 4,
        participantSlotsUsed: event.participants.reduce((sum, p) => sum + (p.addedPeopleCount || 0), 0)
      },
      participants: participantJoins,
      organizers: event.organizers,
      pendingApprovals: event.pendingApprovals || [],
      topContributors: contributors,
      recentActivity: formattedActivity
    });
    
  } catch (error) {
    console.error("Get event by ID/Code error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get event by ID (alias for consistency)
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id)
      .populate("createdBy", "name email")
      .populate("organizers", "name email isActive")
      .populate("participants", "username email profileImage dob addedPeopleCount");
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    // Get relationship count
    const relationshipsCount = await Relationship.countDocuments({
      eventId: event._id,
      isValidated: true
    });
    
    res.status(200).json({
      success: true,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        description: event.description,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        eventType: event.eventType,
        qrCode: event.qrCodeImage,
        approvalMode: event.approvalMode,
        isActive: event.isActive,
        settings: event.settings,
        schedule: event.schedule,
        createdBy: event.createdBy,
        createdAt: event.createdAt
      },
      statistics: {
        totalParticipants: event.participants.length,
        totalOrganizers: event.organizers.length,
        totalRelationships: relationshipsCount,
        pendingApprovals: event.pendingApprovals?.length || 0
      },
      participants: event.participants,
      organizers: event.organizers
    });
    
  } catch (error) {
    console.error("Get event by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get event by code only (simple version)
export const getEventByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const event = await Event.findOne({ eventCode: code })
      .populate("createdBy", "name email")
      .populate("organizers", "name email isActive")
      .select("-qrCodeImage"); // Exclude QR code for faster response
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: `Event not found with code: ${code}`
      });
    }
    
    res.status(200).json({
      success: true,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        description: event.description,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        eventType: event.eventType,
        approvalMode: event.approvalMode,
        isActive: event.isActive,
        totalParticipants: event.participants.length,
        createdBy: event.createdBy
      }
    });
    
  } catch (error) {
    console.error("Get event by code error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateEventApprovalMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalMode } = req.body; // 'auto' or 'manual'
    
    const event = await Event.findById(id);
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
      message: `Approval mode updated to ${approvalMode}`,
      approvalMode: event.approvalMode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Events (Admin View)
export const getAllEventsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("createdBy", "name email")
        .populate("organizers", "name email isActive")
        .populate("participants", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(query),
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

// Delete/Deactivate Event
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Soft delete - deactivate instead of hard delete
    event.isActive = false;
    await event.save();

    // Also deactivate all organizers associated with this event
    await Organizer.updateMany({ assignedEvent: id }, { isActive: false });

    res.status(200).json({
      success: true,
      message: "Event deactivated successfully",
      event: {
        id: event._id,
        name: event.eventName,
        isActive: event.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get System Logs
export const getSystemLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      module,
      action,
      userId,
      startDate,
      endDate,
    } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (module) query.module = module;
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'username name email profileImage'),
      Log.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update tree visibility for an event (admin only)
export const updateTreeVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { treeVisibility } = req.body;

    const valid = ["participants", "organizer_only", "admin_only"];
    if (!valid.includes(treeVisibility)) {
      return res.status(400).json({ success: false, message: `treeVisibility must be one of: ${valid.join(", ")}` });
    }

    const event = await Event.findByIdAndUpdate(id, { treeVisibility }, { new: true });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.status(200).json({
      success: true,
      message: "Tree visibility updated",
      treeVisibility: event.treeVisibility,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveUserAdmin = async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const pendingIdx = event.pendingApprovals.findIndex(id => id.toString() === userId);
    if (pendingIdx === -1) return res.status(404).json({ success: false, message: "User not in pending approvals" });

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

export const rejectUserAdmin = async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const pendingIdx = event.pendingApprovals.findIndex(id => id.toString() === userId);
    if (pendingIdx === -1) return res.status(404).json({ success: false, message: "User not in pending approvals" });

    event.pendingApprovals.splice(pendingIdx, 1);
    await event.save();

    await sendNotification(userId, "approval", "Join Request Not Approved",
      `Your request to join "${event.eventName}" was not approved.`, event._id);

    res.status(200).json({ success: true, message: "User rejected successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventName, description, eventDate, eventEndDate,
      approvalMode, isActive, groomName, brideName, mainPersonName, treeVisibility,
      groomImage, brideImage, mainPersonImage,
    } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (eventName !== undefined) event.eventName = eventName;
    if (description !== undefined) event.description = description;
    if (eventDate !== undefined) event.eventDate = eventDate ? new Date(eventDate) : event.eventDate;
    if (eventEndDate !== undefined) event.eventEndDate = eventEndDate ? new Date(eventEndDate) : null;
    if (approvalMode !== undefined) event.approvalMode = approvalMode;
    if (isActive !== undefined) event.isActive = isActive;
    if (groomName !== undefined) event.groomName = groomName;
    if (brideName !== undefined) event.brideName = brideName;
    if (mainPersonName !== undefined) event.mainPersonName = mainPersonName;
    if (treeVisibility !== undefined) event.treeVisibility = treeVisibility;

    // Also update groom/bride/main placeholder names if provided
    if (groomName && event.treeConfig?.groomId) {
      await User.findByIdAndUpdate(event.treeConfig.groomId, { username: groomName });
    }
    if (brideName && event.treeConfig?.brideId) {
      await User.findByIdAndUpdate(event.treeConfig.brideId, { username: brideName });
    }
    if (mainPersonName && event.treeConfig?.mainPersonId) {
      await User.findByIdAndUpdate(event.treeConfig.mainPersonId, { username: mainPersonName });
    }

    // Upload anchor images to Cloudinary; fall back to base64 storage if Cloudinary fails
    const uploadAnchorImage = async (base64DataUrl) => {
      if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) return null;
      try {
        const buf = Buffer.from(base64DataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        return await uploadBufferToCloudinary(buf, { folder: 'fam/anchors' });
      } catch (err) {
        console.error('Cloudinary upload failed, storing base64 directly:', err.message);
        return base64DataUrl;
      }
    };

    const isWeddingType = event.treeType === 'wedding' || event.treeType === 'anniversary';
    if (isWeddingType) {
      if (groomImage) {
        const url = await uploadAnchorImage(groomImage);
        if (url && event.treeConfig?.groomId) await User.findByIdAndUpdate(event.treeConfig.groomId, { profileImage: url });
      }
      if (brideImage) {
        const url = await uploadAnchorImage(brideImage);
        if (url && event.treeConfig?.brideId) await User.findByIdAndUpdate(event.treeConfig.brideId, { profileImage: url });
      }
    } else if (mainPersonImage) {
      const url = await uploadAnchorImage(mainPersonImage);
      if (url && event.treeConfig?.mainPersonId) await User.findByIdAndUpdate(event.treeConfig.mainPersonId, { profileImage: url });
    }

    await event.save();
    res.json({ success: true, message: 'Event updated', event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrganizers,
      totalEvents,
      activeEvents,
      blockedUsers,
      totalRelationships,
    ] = await Promise.all([
      User.countDocuments(),
      Organizer.countDocuments(),
      Event.countDocuments(),
      Event.countDocuments({ isActive: true }),
      User.countDocuments({ isBlocked: true }),
      Relationship.countDocuments(),
    ]);

    // Get recent activity (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const newUsersLast7Days = await User.countDocuments({
      createdAt: { $gte: last7Days },
    });

    const newEventsLast7Days = await Event.countDocuments({
      createdAt: { $gte: last7Days },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalOrganizers,
        totalEvents,
        activeEvents,
        blockedUsers,
        totalRelationships,
        newUsersLast7Days,
        newEventsLast7Days,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

