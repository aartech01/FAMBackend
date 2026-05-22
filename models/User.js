// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: function () {
        return !this.isTemporary;
      },
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    dob: {
      type: Date,
      required: function () {
        return !this.isTemporary;
      },
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""],
      default: "",
    },
    profession: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "organizer"],
    },
    joinedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    addedPeopleCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },
    familyTreeHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TreeHistory",
      },
    ],
    notificationPreferences: {
      birthday: { type: Boolean, default: true },
      anniversary: { type: Boolean, default: true },
      eventUpdates: { type: Boolean, default: true },
    },
    isDeceased: {
      type: Boolean,
      default: false,
    },
    deathYear: {
      type: Number,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isTemporary: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false, // Don't return OTP by default
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ joinedEvents: 1 });
userSchema.index({ createdAt: -1 });

// Method to check if user can add more people
userSchema.methods.canAddPerson = function () {
  return this.addedPeopleCount < 4;
};

// Method to check if profile is complete
userSchema.methods.isProfileComplete = function () {
  return !!(this.username && this.email && this.dob && this.profileImage);
};

// Method to get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    dob: this.dob,
    profileImage: this.profileImage,
    bloodGroup: this.bloodGroup,
    profession: this.profession,
    location: this.location,
    gender: this.gender,
    socialLinks: this.socialLinks,
    addedPeopleCount: this.addedPeopleCount,
    joinedEvents: this.joinedEvents,
    isDeceased: this.isDeceased,
    deathYear: this.deathYear,
  };
};

const User = mongoose.model("User", userSchema);
export default User;
