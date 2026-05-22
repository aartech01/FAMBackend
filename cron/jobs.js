// cron/jobs.js
import cron from "node-cron";
import { 
  sendBirthdayNotifications, 
  sendAnniversaryNotifications,
  sendEventReminders 
} from "../services/notificationService.js";
import Organizer from "../models/Organizer.js";
import Event from "../models/Event.js";
import Log from "../models/Log.js";

export const startCronJobs = (io) => {
  
  // Birthday notifications - Run daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("🎂 Running birthday notification job...");
    try {
      const result = await sendBirthdayNotifications();
      console.log(`✅ Birthday notifications sent: ${result.sent}`);
    } catch (error) {
      console.error("Birthday notification error:", error);
    }
  });

  // Anniversary notifications - Run daily at 9:15 AM (staggered from birthday job)
  cron.schedule("15 9 * * *", async () => {
    console.log("💑 Running anniversary notification job...");
    try {
      const result = await sendAnniversaryNotifications();
      console.log(`✅ Anniversary notifications sent: ${result.sent}`);
    } catch (error) {
      console.error("Anniversary notification error:", error);
    }
  });

  // Event reminders - Run daily at 8 AM (for next day events)
  cron.schedule("0 8 * * *", async () => {
    console.log("📅 Running event reminder job...");
    try {
      const result = await sendEventReminders();
      console.log(`✅ Event reminders sent: ${result.sent}`);
    } catch (error) {
      console.error("Event reminder error:", error);
    }
  });
  
  // Organizer cleanup - Remove expired organizers (Run daily at midnight)
  cron.schedule("0 0 * * *", async () => {
    console.log("🧹 Running organizer cleanup job...");
    
    try {
      const expiredOrganizers = await Organizer.find({
        validTill: { $lt: new Date() },
        isActive: true,
      });
      
      for (const organizer of expiredOrganizers) {
        organizer.isActive = false;
        await organizer.save();
        
        // Also deactivate related events
        if (organizer.assignedEvent) {
          await Event.updateMany(
            { _id: organizer.assignedEvent },
            { isActive: false }
          );
        }
      }
      
      console.log(`✅ Cleaned up ${expiredOrganizers.length} expired organizers`);
    } catch (error) {
      console.error("Organizer cleanup error:", error);
    }
  });
  
  // Log archival - Archive logs older than 30 days (Run monthly on 1st at 3 AM)
  cron.schedule("0 3 1 * *", async () => {
    console.log("📦 Running log archival job...");
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const oldLogs = await Log.find({
        createdAt: { $lt: thirtyDaysAgo },
      });
      
      // Here you can archive to a file or another collection
      // For now, just delete them
      await Log.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
      
      console.log(`✅ Archived ${oldLogs.length} old logs`);
    } catch (error) {
      console.error("Log archival error:", error);
    }
  });
  
  console.log("⏰ Cron jobs started successfully");
  console.log("   - Birthday notifications: Daily at 9:00 AM");
  console.log("   - Anniversary notifications: Daily at 9:00 AM");
  console.log("   - Event reminders: Daily at 8:00 AM");
  console.log("   - Organizer cleanup: Daily at 12:00 AM");
  console.log("   - Log archival: Monthly on 1st at 3:00 AM");
};