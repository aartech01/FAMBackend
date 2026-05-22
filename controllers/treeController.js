// controllers/treeController.js
import Relationship from "../models/Relationship.js";
import TreeEngine from "../services/treeEngine.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { createLog } from "../services/auditService.js";
import { sendNotification, broadcastTreeUpdate } from "../services/notificationService.js";
import Organizer from "../models/Organizer.js";

// Add relationship
export const addRelationship = async (req, res) => {
  try {
    const { eventId, person1Id, person2Id, relationType, familySide, marriageDate } = req.body;
    const userId = req.user.id;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Regular users must be approved participants; org/admin can act on any event
    if (req.user.role === "user") {
      const isMember = event.participants.some(p => p.toString() === userId.toString());
      if (!isMember) {
        return res.status(403).json({ success: false, message: "You must be an approved participant to add relationships" });
      }
    }

    // Determine family side for wedding events
    let assignedFamilySide = familySide || "common";
    if (event.treeType === "wedding" || event.treeType === "anniversary") {
      if (!familySide) {
        return res.status(400).json({
          success: false,
          message: "For wedding events, familySide (groom/bride) is required"
        });
      }
      assignedFamilySide = familySide;
    }
    
    // Validate relationship
    const validation = await TreeEngine.validateRelationship(
      eventId, person1Id, person2Id, relationType, userId, assignedFamilySide
    );
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }
    
    // Create relationship
    const relationship = new Relationship({
      eventId,
      addedBy: userId,
      person1: person1Id,
      person2: person2Id,
      relationType,
      familySide: assignedFamilySide,
      marriageDate: marriageDate || null,
      isValidated: req.user.role === "organizer" || req.user.role === "admin",
      createdBy: userId,
    });
    
    await relationship.save();
    
    // Update user's addedPeopleCount (skip for main persons)
    const isMainPerson = (event.treeConfig?.mainPersonId?.toString() === userId.toString()) ||
                         (event.treeConfig?.groomId?.toString() === userId.toString()) ||
                         (event.treeConfig?.brideId?.toString() === userId.toString());
    
    if (!isMainPerson) {
      const addingUser = await User.findById(userId);
      if (addingUser) {
        addingUser.addedPeopleCount += 1;
        await addingUser.save();
      }
    }
    
    // Generate updated tree (saveHistory=true — this is a mutation)
    const tree = await TreeEngine.generateFullTree(eventId, true);

    // Create log
    await createLog({
      userId: req.user.id,
      role: req.user.role,
      action: "ADD_RELATIONSHIP",
      module: "tree",
      metadata: { eventId, relationshipId: relationship._id, relationType, familySide: assignedFamilySide },
      ipAddress: req.ip,
    });

    // Broadcast to all participants so every open tree view auto-refreshes.
    // Admin/organizer additions are immediately validated and visible;
    // user submissions are pending but broadcast is harmless (tree unchanged for others).
    broadcastTreeUpdate(event.participants || [], eventId);

    res.status(201).json({
      success: true,
      message: "Relationship added successfully",
      relationship,
      tree,
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove relationship (ONLY organizer/admin)
export const removeRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventId } = req.body;
    
    const result = await TreeEngine.removeRelationship(id, req.user.id, req.user.role, eventId);

    if (result.success) {
      const resolvedEventId = eventId || result.eventId;
      const [tree, eventDoc] = await Promise.all([
        TreeEngine.generateFullTree(resolvedEventId, true),
        Event.findById(resolvedEventId).select('participants'),
      ]);

      await createLog({
        userId: req.user.id,
        role: req.user.role,
        action: "REMOVE_RELATIONSHIP",
        module: "tree",
        metadata: { relationshipId: id, eventId: resolvedEventId },
        ipAddress: req.ip,
      });

      broadcastTreeUpdate(eventDoc?.participants || [], resolvedEventId);

      res.status(200).json({
        success: true,
        message: "Relationship removed successfully",
        tree,
      });
    }

  } catch (error) {
    const status = error.message === "Relationship not found" ? 404
      : error.message.startsWith("Not authorized") ? 403
      : 500;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};

// Update relationship (ONLY organizer/admin)
export const updateRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { relationType, marriageDate, isValidated, familySide } = req.body;
    
    const relationship = await Relationship.findById(id);
    if (!relationship) {
      return res.status(404).json({ success: false, message: "Relationship not found" });
    }
    
    // Check permissions - ONLY organizer or admin
    if (req.user.role !== "admin" && req.user.role !== "organizer") {
      return res.status(403).json({ success: false, message: "Not authorized. Only organizer or admin can update relationships" });
    }
    
    // If organizer, verify they are assigned to this event
    if (req.user.role === "organizer") {
      const organizer = await Organizer.findOne({ _id: req.user.id, isActive: true });
      const targetEventId = relationship.eventId.toString();
      const isAssigned = organizer && (
        organizer.assignedEvent?.toString() === targetEventId ||
        organizer.assignedEvents?.some(e => e.toString() === targetEventId)
      );
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized for this event" });
      }
    }
    
    relationship.relationType = relationType || relationship.relationType;
    relationship.marriageDate = marriageDate || relationship.marriageDate;
    relationship.isValidated = isValidated !== undefined ? isValidated : relationship.isValidated;
    if (familySide) relationship.familySide = familySide;
    
    await relationship.save();
    
    const [tree, eventDoc] = await Promise.all([
      TreeEngine.generateFullTree(relationship.eventId, true),
      Event.findById(relationship.eventId).select('participants'),
    ]);

    broadcastTreeUpdate(eventDoc?.participants || [], relationship.eventId);

    res.status(200).json({
      success: true,
      message: "Relationship updated successfully",
      relationship,
      tree,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get full tree data (based on event type)
export const getTree = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { familySide } = req.query; // For wedding events: 'groom' or 'bride'

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Enforce treeVisibility access control
    const visibility = event.treeVisibility || "participants";
    const role = req.user.role;
    const userId = req.user.id;

    if (visibility === "admin_only" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Tree is restricted to admins only" });
    }
    if (visibility === "organizer_only" && role !== "admin" && role !== "organizer") {
      return res.status(403).json({ success: false, message: "Tree is restricted to organizers and admins" });
    }
    if (visibility === "participants" && role === "user") {
      const isMember = event.participants.some(p => p.toString() === userId.toString());
      const isPending = event.pendingApprovals?.some(p => p.toString() === userId.toString());
      if (!isMember && !isPending) {
        return res.status(403).json({ success: false, message: "You must be joined to this event to view the tree" });
      }
    }

    let treeData;
    if (familySide && (event.treeType === "wedding" || event.treeType === "anniversary")) {
      // Get specific family tree
      treeData = await TreeEngine.generateTree(eventId, familySide);
    } else {
      // Get full tree based on event type
      treeData = await TreeEngine.generateFullTree(eventId);
    }

    res.status(200).json({
      success: true,
      tree: treeData,
      eventMeta: {
        treeType: event.treeType,
        treeConfig: event.treeConfig || {},
        groomName: event.groomName || null,
        brideName: event.brideName || null,
        mainPersonName: event.mainPersonName || null,
      },
      hiddenUserIds: (event.hiddenFromTree || []).map(h => String(h.userId)),
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Relationship path discovery ("how are A and B related?")
export const findRelationshipPath = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fromUserId, toUserId } = req.query;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ success: false, message: "fromUserId and toUserId query params are required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (req.user.role === "user") {
      const isMember = event.participants.some(p => p.toString() === req.user.id.toString());
      if (!isMember) {
        return res.status(403).json({ success: false, message: "You must be a participant to discover relationships" });
      }
    }

    const result = await TreeEngine.findPath(eventId, fromUserId, toUserId);

    res.status(200).json({
      success: true,
      found: result.found,
      path: result.path,
      length: result.length,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tree history
export const getTreeHistory = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { version, familySide } = req.query;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Users must be (or have been) a participant — access persists after event ends
    if (req.user.role === "user") {
      const isMember = event.participants.some(p => p.toString() === req.user.id.toString());
      if (!isMember) {
        return res.status(403).json({ success: false, message: "You must be a participant of this event to view its tree history" });
      }
    } else if (req.user.role === "organizer") {
      const isAssigned = event.organizers.some(o => o.toString() === req.user.id.toString());
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized for this event" });
      }
    }

    const history = await TreeEngine.getTreeHistory(eventId, familySide || "common", version);

    res.status(200).json({
      success: true,
      history,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Set main person for common event
export const setMainPerson = async (req, res) => {
  try {
    const { eventId, userId } = req.body;
    
    // Check permissions - only organizer or admin
    if (req.user.role !== "admin" && req.user.role !== "organizer") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (!event.treeConfig) event.treeConfig = {};
    event.treeConfig.mainPersonId = userId;
    await event.save();
    
    res.status(200).json({
      success: true,
      message: "Main person set successfully",
      mainPerson: user,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Set groom and bride for wedding event
export const setWeddingCouple = async (req, res) => {
  try {
    const { eventId, groomId, brideId } = req.body;
    
    // Check permissions - only organizer or admin
    if (req.user.role !== "admin" && req.user.role !== "organizer") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    
    const groom = await User.findById(groomId);
    const bride = await User.findById(brideId);
    
    if (!groom || !bride) {
      return res.status(404).json({ success: false, message: "Groom or Bride not found" });
    }
    
    if (!event.treeConfig) event.treeConfig = {};
    event.treeConfig.groomId = groomId;
    event.treeConfig.brideId = brideId;
    event.treeType = "wedding";
    await event.save();
    
    // Create spouse relationship between groom and bride
    const existingRelation = await Relationship.findOne({
      eventId,
      person1: groomId,
      person2: brideId,
      relationType: "spouse"
    });
    
    if (!existingRelation) {
      const relationship = new Relationship({
        eventId,
        addedBy: req.user.id,
        person1: groomId,
        person2: brideId,
        relationType: "spouse",
        familySide: "common",
        isValidated: true,
        createdBy: req.user.id,
      });
      await relationship.save();
    }
    
    res.status(200).json({
      success: true,
      message: "Wedding couple set successfully",
      groom,
      bride,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Hide a person node from the tree view (soft — does not remove relationships)
export const hidePersonFromTree = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (req.user.role !== "admin" && req.user.role !== "organizer") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    if (req.user.role === "organizer") {
      const isAssigned = event.organizers.some(o => o.toString() === req.user.id.toString());
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized for this event" });
      }
    }

    const alreadyHidden = (event.hiddenFromTree || []).some(h => h.userId.toString() === userId);
    if (!alreadyHidden) {
      if (!event.hiddenFromTree) event.hiddenFromTree = [];
      event.hiddenFromTree.push({ userId, hiddenBy: req.user.id, hiddenAt: new Date() });
      await event.save();
    }

    await createLog({
      userId: req.user.id,
      role: req.user.role,
      action: "HIDE_PERSON_FROM_TREE",
      module: "tree",
      metadata: { eventId, targetUserId: userId },
      ipAddress: req.ip,
    });

    // Push real-time tree-update event so all participants auto-refresh
    broadcastTreeUpdate(event.participants || [], eventId);

    res.status(200).json({ success: true, message: "Person hidden from tree view" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Restore a hidden person back to visible in the tree
export const restorePersonToTree = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (req.user.role !== "admin" && req.user.role !== "organizer") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    if (req.user.role === "organizer") {
      const isAssigned = event.organizers.some(o => o.toString() === req.user.id.toString());
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized for this event" });
      }
    }

    event.hiddenFromTree = (event.hiddenFromTree || []).filter(h => h.userId.toString() !== userId);
    await event.save();

    await createLog({
      userId: req.user.id,
      role: req.user.role,
      action: "RESTORE_PERSON_TO_TREE",
      module: "tree",
      metadata: { eventId, targetUserId: userId },
      ipAddress: req.ip,
    });

    // Push real-time tree-update event so all participants auto-refresh
    broadcastTreeUpdate(event.participants || [], eventId);

    res.status(200).json({ success: true, message: "Person restored to tree view" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};