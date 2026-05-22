// eventSeed.js — run once after adminSeed.js to create a test event
// Usage: node eventSeed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "./models/Event.js";
import Admin from "./models/Admin.js";

dotenv.config();

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in .env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const admin = await Admin.findOne({ name: "adminFAM" });
    if (!admin) {
      console.error("❌ Admin not found. Run adminSeed.js first.");
      process.exit(1);
    }

    const existing = await Event.findOne({ eventCode: "testevent1001" });
    if (existing) {
      console.log("ℹ️  Seed event already exists:");
      console.log("   Event Code :", existing.eventCode);
      console.log("   Event Name :", existing.eventName);
      await mongoose.disconnect();
      return;
    }

    const event = new Event({
      eventName: "Test Event",
      eventCode: "testevent1001",
      description: "Seed event for development testing",
      eventType: "other",
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      approvalMode: "auto",
      isActive: true,
      createdBy: admin._id,
    });

    await event.save();

    console.log("\n✅ Seed event created!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("   Event Name :", event.eventName);
    console.log("   Event Code :", event.eventCode);
    console.log("   Approval   : auto (users join immediately)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nUse this code in the Dashboard to test joining.");

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

seed();
