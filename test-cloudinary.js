// test-cloudinary.js
import dotenv from "dotenv";
import { v2 as cloudinary } from 'cloudinary';

// Force load .env from current directory
dotenv.config({ path: './.env' });

console.log("=== Cloudinary Credentials Check ===");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME || "❌ NOT FOUND");
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "✅ FOUND" : "❌ NOT FOUND");
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "✅ FOUND" : "❌ NOT FOUND");

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("\n❌ Missing Cloudinary credentials in .env file");
  console.log("Please add these to your .env file:");
  console.log("CLOUDINARY_CLOUD_NAME=your_cloud_name");
  console.log("CLOUDINARY_API_KEY=your_api_key");
  console.log("CLOUDINARY_API_SECRET=your_api_secret");
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const testCloudinary = async () => {
  try {
    console.log("\n✅ Cloudinary configured successfully");
    console.log("Testing upload...");
    
    // Test upload a simple base64 image (1x1 pixel)
    const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const result = await cloudinary.uploader.upload(testImage, {
      folder: "test",
      transformation: [{ width: 100, crop: "limit" }]
    });
    
    console.log("✅ Cloudinary test successful!");
    console.log("Uploaded URL:", result.secure_url);
    console.log("Public ID:", result.public_id);
    
  } catch (error) {
    console.error("❌ Cloudinary test failed:", error.message);
    if (error.message.includes("api_key")) {
      console.log("\n⚠️ Your API credentials are incorrect. Please check:");
      console.log("- Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
      console.log("- API Key:", process.env.CLOUDINARY_API_KEY);
      console.log("- API Secret:", process.env.CLOUDINARY_API_SECRET?.substring(0, 5) + "...");
    }
  }
};

testCloudinary();