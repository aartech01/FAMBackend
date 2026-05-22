// seedOrganizer.js
import Organizer from "./models/Organizer.js";
import bcrypt from "bcryptjs";

// Predefined organizer credentials (for testing/development)
const ORGANIZER_CREDENTIALS = {
  name: "Demo Organizer",
  email: "organizer@familytree.com",
  password: "organizerPass@7890",
  accessCode: "DEMO123",
};

const seedOrganizer = async () => {
  try {
    // Check if organizer already exists by email
    const existingOrganizer = await Organizer.findOne({ 
      $or: [
        { email: ORGANIZER_CREDENTIALS.email },
        { name: ORGANIZER_CREDENTIALS.name }
      ]
    });
    
    if (existingOrganizer) {
      console.log("✅ Demo organizer already exists in database");
      console.log(`   Name: ${existingOrganizer.name}`);
      console.log(`   Email: ${existingOrganizer.email}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ORGANIZER_CREDENTIALS.password, 10);

    // Create new organizer with complete fields
    const organizer = new Organizer({
      name: ORGANIZER_CREDENTIALS.name,
      email: ORGANIZER_CREDENTIALS.email,
      password: hashedPassword,
      role: "organizer",
      assignedEvent: null, // Will be assigned when event is created
      accessCode: ORGANIZER_CREDENTIALS.accessCode,
      isActive: true,
      validTill: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      permissions: [
        "moderate_tree",
        "approve_users", 
        "manage_schedule",
        "view_participants"
      ],
      createdBy: null, // Will be set when admin creates
      lastLogin: null,
    });

    await organizer.save();
    console.log("✅ Demo organizer seeded successfully!");
    console.log(`   Name: ${organizer.name}`);
    console.log(`   Email: ${organizer.email}`);
    console.log(`   Access Code: ${organizer.accessCode}`);
    console.log(`   Temporary Password: ${ORGANIZER_CREDENTIALS.password}`);
    console.log(`   Valid Until: ${organizer.validTill.toDateString()}`);
  } catch (error) {
    console.error("❌ Error seeding organizer:", error.message);
  }
};

export default seedOrganizer;