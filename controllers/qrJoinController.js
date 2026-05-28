// controllers/qrJoinController.js
import Event from "../models/Event.js";
import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import { createLog } from "../services/auditService.js";
import { sendNotification } from "../services/notificationService.js";
import Organizer from "../models/Organizer.js";
import path from "path";
import fs from "fs";

const uploadDir = "./uploads/profiles";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const joinEventFromQR = async (req, res) => {
  try {
    const { eventId, eventCode, userData, familySide, relationToAnchor } = req.body;

    if (!userData || typeof userData !== "object") {
      return res.status(400).json({
        success: false,
        message: "userData is required (name, email, dob)",
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
      socialMediaLink,
    } = userData;

    if (!name || !email || !dob) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and date of birth are required",
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
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (!event.isActive) {
      return res.status(400).json({ success: false, message: "Event is no longer active" });
    }

    // Save profile photo to disk if provided (non-fatal if it fails)
    let profileImageUrl = "";
    if (profilePhoto) {
      try {
        const base64Data = profilePhoto.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const filename = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        profileImageUrl = `/uploads/profiles/${filename}`;
      } catch (photoErr) {
        console.error("Photo save error (non-fatal):", photoErr.message);
      }
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        username: name,
        email,
        dob: new Date(dob),
        profileImage: profileImageUrl,
        bloodGroup: bloodGroup || "",
        profession: profession || "",
        location: location || "",
        gender: gender || "",
        phone: phone || "",
        socialLinks: socialMediaLink
          ? { facebook: socialMediaLink, instagram: "", linkedin: "" }
          : {},
        joinedEvents: [],
      });
      await user.save();
    } else {
      if (profileImageUrl) {
        user.profileImage = profileImageUrl;
        await user.save();
      }
    }

    // Check if already joined or pending
    const alreadyParticipant = event.participants.some(
      (p) => p.toString() === user._id.toString()
    );
    const alreadyPending = event.pendingApprovals.some(
      (p) => p.toString() === user._id.toString()
    );
    const inJoinedEvents = user.joinedEvents.some(
      (e) => e.toString() === event._id.toString()
    );

    if (alreadyParticipant || inJoinedEvents) {
      return res.status(200).json({
        success: true,
        message: "You have already joined this event",
        joinStatus: "already_joined",
        event: { id: event._id, name: event.eventName, code: event.eventCode },
        user: { id: user._id, username: user.username, email: user.email, profileImage: user.profileImage },
      });
    }

    if (alreadyPending) {
      return res.status(200).json({
        success: true,
        message: "Your join request is already pending approval",
        joinStatus: "pending_approval",
        event: { id: event._id, name: event.eventName, code: event.eventCode },
        user: { id: user._id, username: user.username, email: user.email, profileImage: user.profileImage },
      });
    }

    let requiresApproval = false;
    let joinStatus = "pending";

    if (event.approvalMode === "auto") {
      event.participants.push(user._id);
      user.joinedEvents.push(event._id);
      joinStatus = "approved";

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

    // Create a pending relationship to the anchor person if provided
    if (relationToAnchor && familySide) {
      try {
        const isWedding = event.treeType === "wedding" || event.treeType === "anniversary";
        let anchorId = null;

        if (isWedding) {
          if (familySide === "groom") anchorId = event.treeConfig?.groomId;
          else if (familySide === "bride") anchorId = event.treeConfig?.brideId;
        } else {
          anchorId = event.treeConfig?.mainPersonId;
        }

        if (anchorId && anchorId.toString() !== user._id.toString()) {
          const alreadyLinked = await Relationship.findOne({
            eventId: event._id,
            $or: [
              { person1: user._id, person2: anchorId },
              { person1: anchorId, person2: user._id },
            ],
          });

          if (!alreadyLinked) {
            await Relationship.create({
              eventId: event._id,
              addedBy: user._id,
              person1: user._id,
              person2: anchorId,
              relationType: relationToAnchor,
              familySide: isWedding ? familySide : "common",
              isValidated: true,   // self-declared on QR join → visible immediately; organizer can remove if wrong
              createdBy: user._id,
            });
          }
        }
      } catch (relErr) {
        console.error("Relationship creation error (non-fatal):", relErr.message);
      }
    }

    await createLog({
      userId: user._id,
      role: "user",
      action: "QR_JOIN_EVENT",
      module: "event",
      metadata: {
        eventId: event._id,
        eventName: event.eventName,
        hasPhoto: !!profileImageUrl,
        approvalMode: event.approvalMode,
        familySide: familySide || null,
        relationToAnchor: relationToAnchor || null,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: requiresApproval
        ? "Join request sent for approval"
        : "Successfully joined the event",
      joinStatus,
      requiresApproval,
      event: { id: event._id, name: event.eventName, code: event.eventCode },
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("QR Join error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventJoinForm = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Resolve anchor person IDs so the frontend can build the relationship selector
    const anchorPersons = {};
    if (event.treeConfig?.groomId) {
      anchorPersons.groom = {
        id: event.treeConfig.groomId,
        name: event.groomName || "Groom",
      };
    }
    if (event.treeConfig?.brideId) {
      anchorPersons.bride = {
        id: event.treeConfig.brideId,
        name: event.brideName || "Bride",
      };
    }
    if (event.treeConfig?.mainPersonId) {
      anchorPersons.main = {
        id: event.treeConfig.mainPersonId,
        name: event.mainPersonName || "Main Person",
      };
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
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
