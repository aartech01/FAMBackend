// reseedAdmin.js - Place this in the ROOT directory (FAM_Backend/)
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load .env from current directory
dotenv.config();

const reseedAdmin = async () => {
  try {
    console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
    
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in .env file");
      console.log("Please check your .env file exists and has MONGO_URI");
      return;
    }
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const adminsCollection = db.collection('admins');
    
    // Delete all existing admins
    const deleteResult = await adminsCollection.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing admins`);
    
    // Hash password
    const hashedPassword = await bcrypt.hash("adminPass@4569", 10);
    
    // Create new admin with email
    const result = await adminsCollection.insertOne({
      name: "adminFAM",
      email: "admin@familytree.com",
      password: hashedPassword,
      role: "admin",
      permissions: [
        "create_event",
        "delete_event",
        "manage_organizers",
        "manage_users",
        "view_logs",
        "system_settings"
      ],
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log("\n✅ Admin reseeded successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("   Name: adminFAM");
    console.log("   Email: admin@familytree.com");
    console.log("   Password: adminPass@4569");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Verify the admin was created
    const verify = await adminsCollection.findOne({ name: "adminFAM" });
    if (verify) {
      console.log("\n✅ Verification:");
      console.log(`   Name: ${verify.name}`);
      console.log(`   Email: ${verify.email}`);
      console.log(`   Has password: ${verify.password ? "Yes" : "No"}`);
      
      // Test password verification
      const isValid = await bcrypt.compare("adminPass@4569", verify.password);
      console.log(`   Password correct: ${isValid ? "✅ Yes" : "❌ No"}`);
    }
    
    await mongoose.disconnect();
    console.log("\n🎉 You can now login with these credentials!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
};

reseedAdmin();