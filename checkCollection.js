// checkCollection.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("\n📁 All Collections:");
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check admins collection specifically
    const adminsCollection = db.collection('admins');
    const adminCount = await adminsCollection.countDocuments();
    console.log(`\n👑 Admins collection count: ${adminCount}`);
    
    if (adminCount > 0) {
      const admins = await adminsCollection.find({}).toArray();
      console.log("\n📋 Admin records:");
      admins.forEach(admin => {
        console.log(`   Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Password hash: ${admin.password ? admin.password.substring(0, 30) + "..." : "NO PASSWORD"}`);
        console.log(`   ---`);
      });
    } else {
      console.log("\n⚠️ No admins found! Run seed script.");
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
};

check();