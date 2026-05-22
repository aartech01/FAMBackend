// controllers/qrJoinController.js - FULL CLOUDINARY VERSION
import Event from "../models/Event.js";
import User from "../models/User.js";
import { createLog } from "../services/auditService.js";
import { sendNotification } from "../services/notificationService.js";
import Relationship from "../models/Relationship.js";
import Organizer from "../models/Organizer.js";
import cloudinary from "../config/cloudinary.js";
import stream from "stream";

// Helper function to upload base64 to Cloudinary
const uploadToCloudinary = (base64String, folder = "profile_photos") => {
  return new Promise((resolve, reject) => {
    // Remove the data:image/png;base64, prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        transformation: [
          { width: 500, height: 500, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    // Convert base64 to buffer and pipe to upload stream
    const buffer = Buffer.from(base64Data, 'base64');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
};

// Join event from QR scan (with Cloudinary upload)
export const joinEventFromQR = async (req, res) => {
  try {
    const { eventId, eventCode, userData, isAnchorPerson, relationData } = req.body;

    if (!userData || typeof userData !== "object") {
      return res.status(400).json({
        success: false,
        message: "userData is required (name, email, dob, profilePhoto)",
      });
    }

    const {
      name,
      email,
      dob,
      profilePhoto,
      bloodGroup,
      profession,
      location,
      gender,
      phone,
      socialMediaLink
    } = userData;

    // Validate required fields including photo
    if (!name || !email || !dob) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and date of birth are required"
      });
    }
    
    if (!profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "Profile photo is required"
      });
    }
    
    // Find event
    let event;
    if (eventId) {
      event = await Event.findById(eventId);
    } else if (eventCode) {
      event = await Event.findOne({ eventCode });
    }
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }
    
    if (!event.isActive) {
      return res.status(400).json({
        success: false,
        message: "Event is no longer active"
      });
    }
    
    // Upload photo to Cloudinary
    let profileImageUrl = "";
    try {
      const uploadResult = await uploadToCloudinary(profilePhoto, `events/${event._id}/profiles`);
      profileImageUrl = uploadResult.secure_url;
      console.log("✅ Photo uploaded to Cloudinary:", profileImageUrl);
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload profile photo. Please try again."
      });
    }
    
    // ─── Anchor person flow ───────────────────────────────────────────────────
    if (isAnchorPerson && ['groom', 'bride', 'main'].includes(isAnchorPerson)) {
      const placeholderIdMap = {
        groom: event.treeConfig?.groomId,
        bride: event.treeConfig?.brideId,
        main: event.treeConfig?.mainPersonId,
      };
      const placeholderId = placeholderIdMap[isAnchorPerson];

      if (placeholderId) {
        const anchorUser = await User.findById(placeholderId);

        if (anchorUser && anchorUser.isTemporary) {
          anchorUser.username = name;
          anchorUser.email = email;
          anchorUser.dob = new Date(dob);
          anchorUser.profileImage = profileImageUrl;
          anchorUser.isTemporary = false;
          if (bloodGroup) anchorUser.bloodGroup = bloodGroup;
          if (profession) anchorUser.profession = profession;
          if (location) anchorUser.location = location;
          if (gender) anchorUser.gender = gender;
          if (phone) anchorUser.phone = phone;
          if (socialMediaLink) anchorUser.socialLinks = { facebook: socialMediaLink, instagram: "", linkedin: "" };
          if (!anchorUser.joinedEvents.some(e => e.toString() === event._id.toString())) {
            anchorUser.joinedEvents.push(event._id);
          }
          await anchorUser.save();

          await createLog({
            userId: anchorUser._id,
            role: "user",
            action: "QR_JOIN_AS_ANCHOR",
            module: "event",
            metadata: { eventId: event._id, eventName: event.eventName, anchorRole: isAnchorPerson },
            ipAddress: req.ip,
          });

          return res.status(200).json({
            success: true,
            message: `Successfully joined as ${isAnchorPerson === 'main' ? 'main person' : isAnchorPerson}`,
            joinStatus: "approved",
            requiresApproval: false,
            event: { id: event._id, name: event.eventName, code: event.eventCode },
            user: { id: anchorUser._id, username: anchorUser.username, email: anchorUser.email, profileImage: anchorUser.profileImage },
          });
        }
      }
      // Fallthrough: placeholder not found or already claimed — treat as guest
    }

    // ─── Guest flow ───────────────────────────────────────────────────────────
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        username: name,
        email: email,
        dob: new Date(dob),
        profileImage: profileImageUrl,
        bloodGroup: bloodGroup || "",
        profession: profession || "",
        location: location || "",
        gender: gender || "",
        phone: phone || "",
        socialLinks: socialMediaLink ? { facebook: socialMediaLink, instagram: "", linkedin: "" } : {},
        joinedEvents: [],
      });
      await user.save();
      console.log("✅ New user created:", user._id);
    } else {
      user.profileImage = profileImageUrl;
      await user.save();
      console.log("✅ Existing user updated with new photo:", user._id);
    }

    // Check if already joined
    if (user.joinedEvents.some(e => e.toString() === event._id.toString())) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this event"
      });
    }

    // Handle approval based on event settings
    let requiresApproval = false;
    let joinStatus = "pending";

    if (event.approvalMode === "auto") {
      event.participants.push(user._id);
      user.joinedEvents.push(event._id);
      joinStatus = "approved";

      // Create relationship to anchor person if provided
      if (relationData?.relationType && relationData?.targetPersonId) {
        try {
          await Relationship.create({
            eventId: event._id,
            addedBy: user._id,
            person1: user._id,
            person2: relationData.targetPersonId,
            relationType: relationData.relationType,
            familySide: relationData.familySide || "common",
            isValidated: false,
            createdBy: user._id,
          });
        } catch (relErr) {
          console.error("Relationship creation error (non-fatal):", relErr.message);
        }
      }

      await sendNotification(
        user._id,
        "approval",
        "Welcome to the Event! 🎉",
        `You have successfully joined ${event.eventName}. Start building your family tree!`,
        event._id
      );
    } else {
      if (!event.pendingApprovals) event.pendingApprovals = [];
      event.pendingApprovals.push(user._id);
      requiresApproval = true;
      joinStatus = "pending_approval";

      const organizers = await Organizer.find({ assignedEvent: event._id });
      for (const organizer of organizers) {
        await sendNotification(
          organizer._id,
          "approval",
          "New Join Request",
          `${user.username} wants to join ${event.eventName}. Please review and approve.`,
          event._id
        );
      }

      await sendNotification(
        user._id,
        "approval",
        "Join Request Sent",
        `Your request to join ${event.eventName} has been sent for approval. You'll be notified once approved.`,
        event._id
      );
    }

    await event.save();
    await user.save();

    await createLog({
      userId: user._id,
      role: "user",
      action: "QR_JOIN_EVENT",
      module: "event",
      metadata: {
        eventId: event._id,
        eventName: event.eventName,
        hasPhoto: true,
        photoUrl: profileImageUrl,
        approvalMode: event.approvalMode,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: requiresApproval ? "Join request sent for approval" : "Successfully joined the event",
      joinStatus,
      requiresApproval,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
      },
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
    
  } catch (error) {
    console.error("QR Join error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get event join form data
export const getEventJoinForm = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Populate anchor persons from treeConfig
    let anchorPersons = {};
    if (event.treeConfig) {
      if (event.treeConfig.groomId) {
        const groom = await User.findById(event.treeConfig.groomId).select('username profileImage');
        if (groom) anchorPersons.groom = { id: groom._id, username: groom.username, profileImage: groom.profileImage };
      }
      if (event.treeConfig.brideId) {
        const bride = await User.findById(event.treeConfig.brideId).select('username profileImage');
        if (bride) anchorPersons.bride = { id: bride._id, username: bride.username, profileImage: bride.profileImage };
      }
      if (event.treeConfig.mainPersonId) {
        const main = await User.findById(event.treeConfig.mainPersonId).select('username profileImage');
        if (main) anchorPersons.main = { id: main._id, username: main.username, profileImage: main.profileImage };
      }
    }

    res.status(200).json({
      success: true,
      event: {
        id: event._id,
        name: event.eventName,
        code: event.eventCode,
        eventDate: event.eventDate,
        description: event.description,
        approvalMode: event.approvalMode,
        eventType: event.eventType,
        treeType: event.treeType,
        groomName: event.groomName || null,
        brideName: event.brideName || null,
        mainPersonName: event.mainPersonName || null,
        anchorPersons,
        formFields: {
          required: [
            { name: "name", type: "text", label: "Full Name", placeholder: "Enter your full name" },
            { name: "email", type: "email", label: "Email Address", placeholder: "you@example.com" },
            { name: "dob", type: "date", label: "Date of Birth", placeholder: "YYYY-MM-DD" },
            { name: "profilePhoto", type: "file", label: "Profile Photo", accept: "image/*", required: true }
          ],
          optional: [
            { name: "bloodGroup", type: "select", label: "Blood Group", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
            { name: "profession", type: "text", label: "Profession", placeholder: "Your profession" },
            { name: "location", type: "text", label: "Location", placeholder: "City, Country" },
            { name: "gender", type: "select", label: "Gender", options: ["male", "female", "other"] },
            { name: "phone", type: "tel", label: "Phone Number", placeholder: "+1234567890" },
            { name: "socialMediaLink", type: "url", label: "Social Media Link", placeholder: "https://..." }
          ]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};







// // controllers/qrJoinController.js
// import Event from "../models/Event.js";
// import User from "../models/User.js";
// import { createLog } from "../services/auditService.js";
// import { sendNotification } from "../services/notificationService.js";
// import path from "path";
// import fs from "fs";

// // Ensure upload directory exists
// const uploadDir = "./uploads/profiles";
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // Join event from QR scan (with photo upload)
// export const joinEventFromQR = async (req, res) => {
//   try {
//     const { eventId, eventCode, userData } = req.body;
    
//     const { 
//       name, 
//       email, 
//       dob, 
//       profilePhoto, // Base64 encoded photo
//       bloodGroup, 
//       profession, 
//       location, 
//       gender, 
//       phone, 
//       socialMediaLink 
//     } = userData;
    
//     // Validate required fields including photo
//     if (!name || !email || !dob) {
//       return res.status(400).json({
//         success: false,
//         message: "Name, email, and date of birth are required"
//       });
//     }
    
//     if (!profilePhoto) {
//       return res.status(400).json({
//         success: false,
//         message: "Profile photo is required"
//       });
//     }
    
//     // Find event
//     let event;
//     if (eventId) {
//       event = await Event.findById(eventId);
//     } else if (eventCode) {
//       event = await Event.findOne({ eventCode });
//     }
    
//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found"
//       });
//     }
    
//     if (!event.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Event is no longer active"
//       });
//     }
    
//     // Check if user already exists
//     let user = await User.findOne({ email });
    
//     // Save profile photo
//     let profileImageUrl = "";
//     if (profilePhoto) {
//       // Remove base64 prefix if present
//       const base64Data = profilePhoto.replace(/^data:image\/\w+;base64,/, "");
//       const imageBuffer = Buffer.from(base64Data, 'base64');
      
//       // Generate unique filename
//       const timestamp = Date.now();
//       const randomStr = Math.random().toString(36).substring(2, 8);
//       const filename = `user_${timestamp}_${randomStr}.png`;
//       const filepath = path.join(uploadDir, filename);
      
//       // Save file
//       fs.writeFileSync(filepath, imageBuffer);
//       profileImageUrl = `/uploads/profiles/${filename}`;
//     }
    
//     if (!user) {
//       // Create new user with photo
//       user = new User({
//         username: name,
//         email: email,
//         dob: new Date(dob),
//         profileImage: profileImageUrl,
//         bloodGroup: bloodGroup || "",
//         profession: profession || "",
//         location: location || "",
//         gender: gender || "",
//         phone: phone || "",
//         socialLinks: socialMediaLink ? { facebook: socialMediaLink, instagram: "", linkedin: "" } : {},
//         joinedEvents: [],
//       });
//       await user.save();
//     } else {
//       // Update existing user's photo if provided
//       if (profileImageUrl) {
//         user.profileImage = profileImageUrl;
//       }
//       await user.save();
//     }
    
//     // Check if already joined
//     if (user.joinedEvents.includes(event._id)) {
//       return res.status(400).json({
//         success: false,
//         message: "You have already joined this event"
//       });
//     }
    
//     // Handle approval based on event settings
//     let requiresApproval = false;
//     let joinStatus = "pending";
    
//     if (event.approvalMode === "auto") {
//       // Auto-approve
//       event.participants.push(user._id);
//       user.joinedEvents.push(event._id);
//       joinStatus = "approved";
      
//       await sendNotification(
//         user._id,
//         "approval",
//         "Welcome to the Event!",
//         `You have successfully joined ${event.eventName}. Start building your family tree!`,
//         event._id
//       );
//     } else {
//       // Manual approval - add to pending
//       if (!event.pendingApprovals) {
//         event.pendingApprovals = [];
//       }
//       event.pendingApprovals.push(user._id);
//       requiresApproval = true;
//       joinStatus = "pending_approval";
      
//       // Notify organizers
//       const Organizer = await import("../models/Organizer.js");
//       const organizers = await Organizer.default.find({ assignedEvent: event._id });
//       for (const organizer of organizers) {
//         await sendNotification(
//           organizer._id,
//           "approval",
//           "New Join Request",
//           `${user.username} wants to join ${event.eventName}`,
//           event._id
//         );
//       }
      
//       await sendNotification(
//         user._id,
//         "approval",
//         "Join Request Sent",
//         `Your request to join ${event.eventName} has been sent for approval. You'll be notified once approved.`,
//         event._id
//       );
//     }
    
//     await event.save();
//     await user.save();
    
//     // Create log
//     await createLog({
//       userId: user._id,
//       role: "user",
//       action: "QR_JOIN_EVENT",
//       module: "event",
//       metadata: { eventId: event._id, hasPhoto: !!profileImageUrl },
//       ipAddress: req.ip,
//     });
    
//     res.status(200).json({
//       success: true,
//       message: requiresApproval ? "Join request sent for approval" : "Successfully joined the event",
//       joinStatus,
//       requiresApproval,
//       event: {
//         id: event._id,
//         name: event.eventName,
//         code: event.eventCode,
//       },
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//         profileImage: user.profileImage,
//       }
//     });
    
//   } catch (error) {
//     console.error("QR Join error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// // Get event join form data (with photo field)
// export const getEventJoinForm = async (req, res) => {
//   try {
//     const { eventId } = req.params;
    
//     const event = await Event.findById(eventId);
//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found"
//       });
//     }
    
//     res.status(200).json({
//       success: true,
//       event: {
//         id: event._id,
//         name: event.eventName,
//         code: event.eventCode,
//         eventDate: event.eventDate,
//         description: event.description,
//         approvalMode: event.approvalMode,
//         formFields: {
//           required: [
//             { name: "name", type: "text", label: "Full Name", placeholder: "Enter your full name" },
//             { name: "email", type: "email", label: "Email Address", placeholder: "you@example.com" },
//             { name: "dob", type: "date", label: "Date of Birth", placeholder: "YYYY-MM-DD" },
//             { name: "profilePhoto", type: "file", label: "Profile Photo", accept: "image/*", required: true }
//           ],
//           optional: [
//             { name: "bloodGroup", type: "select", label: "Blood Group", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
//             { name: "profession", type: "text", label: "Profession", placeholder: "Your profession" },
//             { name: "location", type: "text", label: "Location", placeholder: "City, Country" },
//             { name: "gender", type: "select", label: "Gender", options: ["male", "female", "other"] },
//             { name: "phone", type: "tel", label: "Phone Number", placeholder: "+1234567890" },
//             { name: "socialMediaLink", type: "url", label: "Social Media Link", placeholder: "https://..." }
//           ]
//         }
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };