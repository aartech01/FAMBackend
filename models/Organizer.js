// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";

// const organizerSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   password: {
//     type: String,
//     required: true,
//   },
//   role: {
//     type: String,
//     default: "organizer",
//   },
//   isActive: {
//     type: Boolean,
//     default: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// // Hash password before saving
// organizerSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// // Compare password method
// organizerSchema.methods.comparePassword = async function (password) {
//   return await bcrypt.compare(password, this.password);
// };

// const Organizer = mongoose.model("Organizer", organizerSchema);
// export default Organizer;







// models/Organizer.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const organizerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "organizer",
  },
  assignedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  assignedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  }],
  accessCode: {
    type: String,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  validTill: {
    type: Date,
  },
  permissions: [{
    type: String,
    enum: ["moderate_tree", "approve_users", "manage_schedule", "view_participants"],
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  lastLogin: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
organizerSchema.pre("save", async function () {
  this.updatedAt = new Date();
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
organizerSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Organizer = mongoose.model("Organizer", organizerSchema);
export default Organizer;