// controllers/qrJoinController.js
import Event from "../models/Event.js";
import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import { createLog } from "../services/auditService.js";
import { sendNotification, broadcastToEventRoom } from "../services/notificationService.js";
import Organizer from "../models/Organizer.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

export const joinEventFromQR = async (req, res) => {
  try {
    const { eventId, eventCode, userData, familySide, relationToAnchor, anchorUserId, spouseUserId } = req.body;

    if (!userData || typeof userData !== "object") {
      return res.status(400).json({
        success: false,
        message: "userData is required (name, email, dob)",
      });
    }

    const {
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
    const name = (userData.name || '').trim();

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

    // Upload profile photo to Cloudinary if provided (non-fatal if it fails)
    let profileImageUrl = "";
    if (profilePhoto) {
      try {
        const base64Data = profilePhoto.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        profileImageUrl = await uploadBufferToCloudinary(imageBuffer, { folder: 'fam/profiles' });
      } catch (photoErr) {
        console.error("Photo upload error (non-fatal):", photoErr.message);
      }
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      try {
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
      } catch (saveErr) {
        if (saveErr.code === 11000) {
          // Concurrent request already created this user — fetch it
          user = await User.findOne({ email });
          if (!user) throw saveErr;
        } else {
          throw saveErr;
        }
      }
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

    try {
      await event.save();
    } catch (savErr) {
      if (savErr.name === 'VersionError') {
        // Re-fetch and re-apply the participant/pending change
        event = await Event.findById(event._id);
        const alreadyIn = event.participants.some(p => p.toString() === user._id.toString())
                       || event.pendingApprovals.some(p => p.toString() === user._id.toString());
        if (!alreadyIn) {
          if (joinStatus === 'approved') event.participants.push(user._id);
          else event.pendingApprovals.push(user._id);
        }
        await event.save();
      } else {
        throw savErr;
      }
    }
    await user.save();

    // Normalise familySide — must be a valid enum value
    const safeSide = ['groom', 'bride', 'common'].includes(familySide) ? familySide : 'common';

    // Create a relationship to the anchor person if provided
    if (relationToAnchor && safeSide) {
      try {
        const isWedding = event.treeType === "wedding" || event.treeType === "anniversary";

        // Resolve anchor: prefer explicit anchorUserId (Option 1), fall back to groom/bride
        let finalAnchorId = null;
        if (anchorUserId) {
          // Validate anchor belongs to this event (participant or primary person from treeConfig)
          const isValidAnchor =
            event.treeConfig?.groomId?.toString() === anchorUserId ||
            event.treeConfig?.brideId?.toString() === anchorUserId ||
            event.treeConfig?.mainPersonId?.toString() === anchorUserId ||
            event.participants.some(p => p.toString() === anchorUserId);
          if (isValidAnchor) finalAnchorId = anchorUserId;
        }
        if (!finalAnchorId) {
          if (isWedding) {
            if (familySide === "groom") finalAnchorId = event.treeConfig?.groomId?.toString();
            else if (familySide === "bride") finalAnchorId = event.treeConfig?.brideId?.toString();
          } else {
            finalAnchorId = event.treeConfig?.mainPersonId?.toString();
          }
        }

        if (finalAnchorId && finalAnchorId !== user._id.toString()) {
          const alreadyLinked = await Relationship.findOne({
            eventId: event._id,
            $or: [
              { person1: user._id, person2: finalAnchorId },
              { person1: finalAnchorId, person2: user._id },
            ],
          });
          if (!alreadyLinked) {
            await Relationship.create({
              eventId: event._id,
              addedBy: user._id,
              person1: user._id,
              person2: finalAnchorId,
              relationType: relationToAnchor,
              familySide: isWedding ? safeSide : "common",
              isValidated: true,
              createdBy: user._id,
            });
          }
        }

        // Option 3: create a spouse edge if spouseUserId is provided (separate from main relation)
        if (spouseUserId && spouseUserId !== user._id.toString()) {
          const isValidSpouse =
            event.treeConfig?.groomId?.toString() === spouseUserId ||
            event.treeConfig?.brideId?.toString() === spouseUserId ||
            event.treeConfig?.mainPersonId?.toString() === spouseUserId ||
            event.participants.some(p => p.toString() === spouseUserId);
          if (isValidSpouse) {
            const alreadySpouseLinked = await Relationship.findOne({
              eventId: event._id,
              $or: [
                { person1: user._id, person2: spouseUserId },
                { person1: spouseUserId, person2: user._id },
              ],
            });
            if (!alreadySpouseLinked) {
              await Relationship.create({
                eventId: event._id,
                addedBy: user._id,
                person1: user._id,
                person2: spouseUserId,
                relationType: "spouse",
                familySide: isWedding ? safeSide : "common",
                isValidated: true,
                createdBy: user._id,
              });
            }
          }
        }
      } catch (relErr) {
        console.error("Relationship creation error (non-fatal):", relErr.message);
      }
    }

    // Push real-time tree_update to everyone viewing this event's tree so they
    // see the new node without manually refreshing the page.
    broadcastToEventRoom(event._id, {
      type: "member_joined",
      userId: String(user._id),
      username: user.username,
      profileImage: user.profileImage || "",
      gender: user.gender || "",
      joinStatus,
    });

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

// Returns existing tree members for a given event + familySide so the QR form
// can show an anchor picker (Option 1) and spouse picker (Option 3).
export const getTreeMembers = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { familySide } = req.query;

    const event = await Event.findById(eventId).select('treeConfig treeType');
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const query = { eventId, isValidated: true };
    if (familySide && familySide !== 'common') query.familySide = familySide;

    const relationships = await Relationship.find(query)
      .populate('person1', 'username profileImage gender')
      .populate('person2', 'username profileImage gender');

    const userMap = new Map();
    const addUser = (u, isPrimary = false) => {
      if (!u) return;
      const key = u._id.toString();
      if (!userMap.has(key)) {
        userMap.set(key, { id: u._id, name: u.username, gender: u.gender || '', profileImage: u.profileImage || '', isPrimary });
      } else if (isPrimary) {
        userMap.get(key).isPrimary = true;
      }
    };

    for (const rel of relationships) {
      addUser(rel.person1);
      addUser(rel.person2);
    }

    // Always include the primary anchor (groom/bride/main) even with no relationships yet
    const treeConfig = event.treeConfig || {};
    const primaryId = familySide === 'groom' ? treeConfig.groomId
      : familySide === 'bride' ? treeConfig.brideId
      : treeConfig.mainPersonId;

    if (primaryId && !userMap.has(primaryId.toString())) {
      const u = await User.findById(primaryId).select('username profileImage gender');
      if (u) addUser(u, true);
    } else if (primaryId) {
      userMap.get(primaryId.toString()).isPrimary = true;
    }

    const members = [...userMap.values()].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });

    res.status(200).json({ success: true, members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
