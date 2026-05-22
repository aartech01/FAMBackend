// scripts/checkAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name (needed for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("Checking environment variables:");
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log("MONGO_URI value:", process.env.MONGO_URI?.substring(0, 50) + "...");

const checkAdmin = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error(" MONGO_URI is not defined in .env file");
      process.exit(1);
    }
    
    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\n Collections in database:", collections.map(c => c.name));
    
    // Check admins collection
    const db = mongoose.connection.db;
    const admins = await db.collection('admins').find({}).toArray();
    console.log("\n Admins in database:", JSON.stringify(admins, null, 2));
    
    if (admins.length === 0) {
      console.log("\n No admin found! Run the seed script first.");
    }
    
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error.message);
  }
};

checkAdmin();