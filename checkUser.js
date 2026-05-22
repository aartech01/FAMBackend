// checkUser.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({ email: "jitukumar63766@gmail.com" }).toArray();
    
    console.log("\n📋 User found:", users.length);
    users.forEach(user => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Email:", user.email);
      console.log("Username:", user.username);
      console.log("OTP:", user.otp);
      console.log("OTP Expiry:", user.otpExpiry);
      console.log("isTemporary:", user.isTemporary);
      console.log("Current time:", new Date().toISOString());
      
      if (user.otpExpiry) {
        const isExpired = new Date(user.otpExpiry) < new Date();
        console.log("OTP Expired:", isExpired);
      }
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
};

checkUser();