// services/notificationService.js
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import Event from "../models/Event.js";
import { sendNotificationEmail } from "./emailService.js";

let ioInstance = null;

// Function to set io instance (call this from server.js after io is created)
export const setSocketIO = (io) => {
  ioInstance = io;
};

export const sendNotification = async (userId, type, title, message, relatedEvent = null, relatedUser = null) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;
    
    // Check notification preferences
    const prefKey = type === "birthday" ? "birthday" :
                    type === "anniversary" ? "anniversary" : "eventUpdates";
    
    // Create notification record
    const notification = new Notification({
      recipient: userId,
      type,
      title,
      message,
      relatedEvent,
      relatedUser,
      deliveryMethod: "both",
      isRead: false,
    });
    
    await notification.save();
    
    // Send real-time notification via socket
    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit("new_notification", {
        id: notification._id,
        type,
        title,
        message,
        createdAt: notification.createdAt,
      });
    }
    
    // Send email if user wants it
    if (user.notificationPreferences && user.notificationPreferences[prefKey] !== false) {
      await sendNotificationEmail(user.email, title, message, type);
      notification.emailSent = true;
      await notification.save();
    }
    
    return notification;
  } catch (error) {
    console.error("Notification error:", error);
    return null;
  }
};

// Lightweight socket-only broadcast for tree visibility changes.
// Does NOT persist a Notification record or send email — just pushes a
// real-time 'new_notification' event so clients auto-refresh their tree.
export const broadcastTreeUpdate = (participantIds, eventId) => {
  if (!ioInstance) return;
  const payload = {
    type:    'tree_update',
    title:   'Tree Updated',
    message: 'The family tree has been updated.',
    eventId: String(eventId),
  };
  for (const uid of participantIds) {
    ioInstance.to(`user_${String(uid)}`).emit('new_notification', payload);
  }
};

// Broadcast a tree_update event to everyone currently viewing a specific event's
// tree. Clients join the room event_<eventId> via the join_event_room socket msg.
// No DB record, no email — purely real-time.
export const broadcastToEventRoom = (eventId, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`event_${String(eventId)}`).emit('tree_update', {
    eventId: String(eventId),
    ...payload,
  });
};

// Lightweight socket-only broadcast for theme changes.
// Emits 'theme_changed' so clients update canvas background without a full tree reload.
export const broadcastThemeChange = (participantIds, eventId, theme) => {
  if (!ioInstance) return;
  const payload = { eventId: String(eventId), theme };
  for (const uid of participantIds) {
    ioInstance.to(`user_${String(uid)}`).emit('theme_changed', payload);
  }
};

// Send bulk notifications
export const sendBulkNotifications = async (userIds, type, title, message, relatedEvent = null) => {
  const results = [];
  for (const userId of userIds) {
    const result = await sendNotification(userId, type, title, message, relatedEvent);
    results.push(result);
  }
  return results;
};

// Send birthday notifications (called by cron job)
export const sendBirthdayNotifications = async () => {
  try {
    const today = new Date();
    const todayStr = `${today.getMonth() + 1}-${today.getDate()}`;
    
    const users = await User.find({
      dob: { $exists: true, $ne: null },
      isBlocked: false,
    });
    
    let count = 0;
    
    for (const user of users) {
      if (user.dob) {
        const userBDay = `${user.dob.getMonth() + 1}-${user.dob.getDate()}`;
        if (userBDay === todayStr) {
          await sendNotification(
            user._id,
            "birthday",
            "Happy Birthday! 🎂",
            `Wishing you a very happy birthday, ${user.username}! May your day be filled with joy and celebration.`
          );
          count++;
        }
      }
    }
    
    console.log(`Sent ${count} birthday notifications`);
    return { sent: count };
  } catch (error) {
    console.error("Birthday notification error:", error);
    return { sent: 0, error: error.message };
  }
};

// Send anniversary notifications
export const sendAnniversaryNotifications = async () => {
  try {
    const today = new Date();
    const todayStr = `${today.getMonth() + 1}-${today.getDate()}`;
    
    // Find relationships with marriage date that matches today
    const relationships = await Relationship.find({
      marriageDate: { $exists: true, $ne: null },
      relationType: "spouse",
    }).populate("person1 person2");
    
    let count = 0;
    const notifiedCouples = new Set();
    
    for (const relationship of relationships) {
      if (relationship.marriageDate) {
        const anniversaryDate = `${relationship.marriageDate.getMonth() + 1}-${relationship.marriageDate.getDate()}`;
        
        if (anniversaryDate === todayStr && !notifiedCouples.has(relationship._id.toString())) {
          notifiedCouples.add(relationship._id.toString());
          
          // Send notification to person1
          if (relationship.person1) {
            await sendNotification(
              relationship.person1._id,
              "anniversary",
              "Wedding Anniversary! 💑",
              `Today is your wedding anniversary! Congratulations ${relationship.person1.username}!`
            );
          }
          
          // Send notification to person2
          if (relationship.person2) {
            await sendNotification(
              relationship.person2._id,
              "anniversary",
              "Wedding Anniversary! 💑",
              `Today is your wedding anniversary! Congratulations ${relationship.person2.username}!`
            );
          }
          
          count++;
        }
      }
    }
    
    console.log(`Sent ${count} anniversary notifications`);
    return { sent: count };
  } catch (error) {
    console.error("Anniversary notification error:", error);
    return { sent: 0, error: error.message };
  }
};

// Send event reminder notifications
export const sendEventReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const events = await Event.find({
      eventDate: {
        $gte: new Date(tomorrowStr),
        $lt: new Date(new Date(tomorrowStr).setDate(new Date(tomorrowStr).getDate() + 1))
      },
      isActive: true,
    }).populate("participants");
    
    let count = 0;
    
    for (const event of events) {
      for (const participant of event.participants) {
        await sendNotification(
          participant._id,
          "event_update",
          `Event Tomorrow: ${event.eventName}`,
          `Reminder: ${event.eventName} is tomorrow at ${event.eventDate.toLocaleTimeString()}. Don't miss it!`,
          event._id
        );
        count++;
      }
    }
    
    console.log(`Sent ${count} event reminders`);
    return { sent: count };
  } catch (error) {
    console.error("Event reminder error:", error);
    return { sent: 0, error: error.message };
  }
};