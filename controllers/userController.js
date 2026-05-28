// import User from "../models/User.js";
// import sendOTP from "../utils/sendEmail.js";
// import jwt from "jsonwebtoken";

// const sendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: "Email required",
//       });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

//     let user = await User.findOne({ email });

//     if (!user) {
//       user = await User.create({
//         email,
//         otp,
//         otpExpiry,
//       });
//     } else {
//       user.otp = otp;
//       user.otpExpiry = otpExpiry;

//       await user.save();
//     }

//     await sendOTP(email, otp);

//     res.status(200).json({
//       success: true,
//       message: "OTP sent successfully",
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };



// // VERIFY OTP
// const verifyOtp = async (req, res) => {
//   try {

//     const { email, otp } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.otp !== otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     if (user.otpExpiry < new Date()) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP expired",
//       });
//     }

//     // remove otp after success
//     user.otp = null;
//     user.otpExpiry = null;

//     await user.save();

//     // JWT TOKEN
//     const token = jwt.sign(
//       {
//         id: user._id,
//         email: user.email,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "7d",
//       }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       token,
//       user,
//     });

//   } catch (error) {

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // LOGOUT

// const logout = async (req, res) => {

//   try {

//     return res.status(200).json({
//       success: true,
//       message: "Logout successful",
//     });

//   } catch (error) {

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // GET PROFILE

// const getProfile = async (req, res) => {

//   try {

//     res.status(200).json({
//       success: true,
//       message: "Protected route accessed",
//       user: req.user,
//     });

//   } catch (error) {

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// export { sendOtp, verifyOtp, logout, getProfile };








// // controllers/userController.js
// import User from "../models/User.js";
// import sendOTP from "../utils/sendEmail.js";
// import jwt from "jsonwebtoken";

// // Send OTP
// const sendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: "Email required",
//       });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

//     let user = await User.findOne({ email });

//     if (!user) {
//       user = await User.create({
//         email,
//         username: email.split("@")[0], // Temporary username
//         dob: new Date("2000-01-01"), // Temporary DOB, user will update later
//         otp,
//         otpExpiry,
//       });
//     } else {
//       user.otp = otp;
//       user.otpExpiry = otpExpiry;
//       await user.save();
//     }

//     await sendOTP(email, otp);

//     res.status(200).json({
//       success: true,
//       message: "OTP sent successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Verify OTP
// const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.otp !== otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     if (user.otpExpiry < new Date()) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP expired",
//       });
//     }

//     // Remove OTP after success
//     user.otp = null;
//     user.otpExpiry = null;
//     await user.save();

//     // Generate JWT TOKEN
//     const token = jwt.sign(
//       {
//         id: user._id,
//         email: user.email,
//         name: user.username,
//         role: user.role || "user",
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // Generate Refresh Token
//     const refreshToken = jwt.sign(
//       { id: user._id, role: user.role || "user" },
//       process.env.JWT_REFRESH_SECRET,
//       { expiresIn: "30d" }
//     );

//     user.refreshToken = refreshToken;
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       token,
//       refreshToken,
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         profileImage: user.profileImage,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Refresh Token
// const refreshToken = async (req, res) => {
//   try {
//     const { refreshToken } = req.body;

//     if (!refreshToken) {
//       return res.status(401).json({
//         success: false,
//         message: "Refresh token required",
//       });
//     }

//     // Verify refresh token
//     const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

//     // Find user with this refresh token
//     const user = await User.findOne({
//       _id: decoded.id,
//       refreshToken: refreshToken,
//     });

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid refresh token",
//       });
//     }

//     // Generate new access token
//     const newToken = jwt.sign(
//       {
//         id: user._id,
//         email: user.email,
//         name: user.username,
//         role: user.role || "user",
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.status(200).json({
//       success: true,
//       token: newToken,
//     });
//   } catch (error) {
//     res.status(401).json({
//       success: false,
//       message: "Invalid or expired refresh token",
//     });
//   }
// };

// // Logout
// const logout = async (req, res) => {
//   try {
//     // Remove refresh token from user
//     if (req.user && req.user.id) {
//       await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Logout successful",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Get Profile
// const getProfile = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id)
//       .select("-otp -otpExpiry -refreshToken")
//       .populate("joinedEvents", "eventName eventCode eventDate");

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       user,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Update Profile
// const updateProfile = async (req, res) => {
//   try {
//     const { username, dob, bloodGroup, profession, location, gender, phone, profileImage, socialLinks } = req.body;

//     const user = await User.findById(req.user.id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (username) user.username = username;
//     if (dob) user.dob = dob;
//     if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
//     if (profession !== undefined) user.profession = profession;
//     if (location !== undefined) user.location = location;
//     if (gender !== undefined) user.gender = gender;
//     if (phone !== undefined) user.phone = phone;
//     if (profileImage) user.profileImage = profileImage;
//     if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//         dob: user.dob,
//         bloodGroup: user.bloodGroup,
//         profession: user.profession,
//         location: user.location,
//         gender: user.gender,
//         phone: user.phone,
//         profileImage: user.profileImage,
//         socialLinks: user.socialLinks,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Get User History
// const getUserHistory = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id)
//       .populate("familyTreeHistory");

//     res.status(200).json({
//       success: true,
//       history: user.familyTreeHistory || [],
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Get User Notifications
// const getUserNotifications = async (req, res) => {
//   try {
//     const Notification = (await import("../models/Notification.js")).default;
    
//     const notifications = await Notification.find({ recipient: req.user.id })
//       .sort({ createdAt: -1 })
//       .limit(50);

//     const unreadCount = await Notification.countDocuments({
//       recipient: req.user.id,
//       isRead: false,
//     });

//     res.status(200).json({
//       success: true,
//       notifications,
//       unreadCount,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Update Notification Preferences
// const updateNotificationPreferences = async (req, res) => {
//   try {
//     const { birthday, anniversary, eventUpdates } = req.body;

//     const user = await User.findById(req.user.id);
    
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (birthday !== undefined) user.notificationPreferences.birthday = birthday;
//     if (anniversary !== undefined) user.notificationPreferences.anniversary = anniversary;
//     if (eventUpdates !== undefined) user.notificationPreferences.eventUpdates = eventUpdates;

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Notification preferences updated",
//       preferences: user.notificationPreferences,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// export {
//   sendOtp,
//   verifyOtp,
//   refreshToken,
//   logout,
//   getProfile,
//   updateProfile,
//   getUserHistory,
//   getUserNotifications,
//   updateNotificationPreferences,
// };









// controllers/userController.js
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Event from "../models/Event.js";
import TreeHistory from "../models/TreeHistory.js";
import sendOTP from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Use .select('+otp +otpExpiry') to check existing OTP if needed
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        email,
        otp,
        otpExpiry,
        isTemporary: true,
      });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    }

    const emailResult = await sendOTP(email, otp);
    if (!emailResult?.success) {
      return res.status(500).json({
        success: false,
        message: emailResult?.error
          ? `Email delivery failed: ${emailResult.error}`
          : "Could not send OTP email. Check EMAIL_USER and EMAIL_PASS on the server.",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      isNewUser,
    });
  } catch (error) {
    console.error("Send OTP error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

// Verify OTP (Updated to collect username and DOB for new users)
// const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp, username, dob, ...optionalFields } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.otp !== otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     if (user.otpExpiry < new Date()) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP expired",
//       });
//     }

//     // For new users, require username and DOB
//     const isNewUser = !user.username || user.username === null;
    
//     if (isNewUser) {
//       if (!username) {
//         return res.status(400).json({
//           success: false,
//           message: "Username is required for new users",
//         });
//       }
      
//       if (!dob) {
//         return res.status(400).json({
//           success: false,
//           message: "Date of birth is required for new users",
//         });
//       }
      
//       // Check if username is already taken
//       const existingUser = await User.findOne({ 
//         username: username,
//         _id: { $ne: user._id } 
//       });
      
//       if (existingUser) {
//         return res.status(400).json({
//           success: false,
//           message: "Username already taken. Please choose another.",
//         });
//       }
      
//       // Update user with provided details
//       user.username = username;
//       user.dob = new Date(dob);
//       user.bloodGroup = optionalFields.bloodGroup || "";
//       user.profession = optionalFields.profession || "";
//       user.location = optionalFields.location || "";
//       user.gender = optionalFields.gender || "";
//       user.phone = optionalFields.phone || "";
//       user.isTemporary = false;
//     }

//     // Generate JWT TOKEN
//     const token = jwt.sign(
//       {
//         id: user._id,
//         email: user.email,
//         name: user.username,
//         role: user.role || "user",
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // Generate Refresh Token (JWT_REFRESH_SECRET falls back to JWT_SECRET if not set)
//     const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
//     const refreshToken = jwt.sign(
//       { id: user._id, role: user.role || "user" },
//       refreshSecret,
//       { expiresIn: "30d" }
//     );

//     // Clear OTP and persist refresh token in a single write
//     user.otp = null;
//     user.otpExpiry = null;
//     user.refreshToken = refreshToken;
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       token,
//       refreshToken,
//       isNewUser: isNewUser, // Let frontend know if profile needs completion
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//         dob: user.dob,
//         role: user.role,
//         profileImage: user.profileImage,
//         profileComplete: !!(user.username && user.dob),
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// Verify OTP - FIXED VERSION
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, username, dob, ...optionalFields } = req.body;

    // IMPORTANT: Use .select('+otp +otpExpiry') to get hidden fields
    const user = await User.findOne({ email }).select('+otp +otpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check OTP
    if (!user.otp) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new OTP.",
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    // Check if profile needs update
    const needsProfileUpdate = (!user.username || user.username === null || 
                                 !user.dob || user.dob === null);
    
    if (needsProfileUpdate) {
      if (username && dob) {
        // Check if username is already taken
        const existingUser = await User.findOne({ 
          username: username,
          _id: { $ne: user._id } 
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Username already taken. Please choose another.",
          });
        }
        
        user.username = username;
        user.dob = new Date(dob);
        user.bloodGroup = optionalFields.bloodGroup || "";
        user.profession = optionalFields.profession || "";
        user.location = optionalFields.location || "";
        user.gender = optionalFields.gender || "";
        user.phone = optionalFields.phone || "";
        user.isTemporary = false;
      } else if (!user.username || user.username === null) {
        // Auto-generate username from email; keep isTemporary=true until DOB is also provided
        user.username = email.split("@")[0];
      }
    }

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;

    // Generate JWT TOKEN
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.username,
        role: user.role || "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Generate Refresh Token
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const refreshToken = jwt.sign(
      { id: user._id, role: user.role || "user" },
      refreshSecret,
      { expiresIn: "30d" }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      isNewUser: needsProfileUpdate,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        dob: user.dob,
        role: user.role,
        profileImage: user.profileImage,
        profileComplete: !!(user.username && user.dob),
      },
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Refresh Token (No change needed)
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: refreshToken,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const newToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.username,
        role: user.role || "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};

// Logout (No change needed)
const logout = async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Profile (No change needed)
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-otp -otpExpiry -refreshToken")
      .populate("joinedEvents", "eventName eventCode eventDate");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
      profileComplete: !!(user.username && user.dob),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload profile image to Cloudinary
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const url = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "profiles",
      public_id: `user_${req.user.id}`,
      overwrite: true,
    });

    await User.findByIdAndUpdate(req.user.id, { profileImage: url });

    res.status(200).json({ success: true, profileImage: url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const { username, dob, bloodGroup, profession, location, gender, phone, profileImage, socialLinks, isDeceased, deathYear } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if username is being changed and is unique
    if (username && username !== user.username) {
      const existingUser = await User.findOne({
        username: username,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }
      user.username = username;
    }

    if (profileImage !== undefined) {
      if (profileImage === "") {
        user.profileImage = "";
      } else {
        try {
          const parsed = new URL(profileImage);
          if (parsed.protocol !== "https:" || !parsed.hostname.includes("cloudinary.com")) {
            return res.status(400).json({ success: false, message: "profileImage must be a Cloudinary HTTPS URL — use POST /api/user/profile/upload-image to upload" });
          }
        } catch {
          return res.status(400).json({ success: false, message: "profileImage must be a valid URL" });
        }
        user.profileImage = profileImage;
      }
    }

    if (dob) user.dob = dob;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    if (profession !== undefined) user.profession = profession;
    if (location !== undefined) user.location = location;
    if (gender !== undefined) user.gender = gender;
    if (phone !== undefined) user.phone = phone;
    if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };
    if (isDeceased !== undefined) user.isDeceased = isDeceased;
    if (deathYear !== undefined) user.deathYear = deathYear;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        dob: user.dob,
        bloodGroup: user.bloodGroup,
        profession: user.profession,
        location: user.location,
        gender: user.gender,
        phone: user.phone,
        profileImage: user.profileImage,
        socialLinks: user.socialLinks,
        isDeceased: user.isDeceased,
        deathYear: user.deathYear,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("joinedEvents");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const events = await Event.find({ _id: { $in: user.joinedEvents } })
      .select("eventName eventType eventDate eventEndDate isActive treeType participants")
      .sort({ eventDate: -1 });

    const history = await Promise.all(
      events.map(async (event) => {
        const latestSnapshot = await TreeHistory.findOne({ eventId: event._id })
          .sort({ version: -1 })
          .select("version snapshotDate familySide nodes edges generatedMermaidCode");

        return {
          event: {
            id: event._id,
            eventName: event.eventName,
            eventType: event.eventType,
            eventDate: event.eventDate,
            eventEndDate: event.eventEndDate,
            isActive: event.isActive,
            treeType: event.treeType,
            participantCount: event.participants?.length || 0,
          },
          latestSnapshot: latestSnapshot || null,
        };
      })
    );

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Notification Preferences (No change needed)
const updateNotificationPreferences = async (req, res) => {
  try {
    const { birthday, anniversary, eventUpdates } = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (birthday !== undefined) user.notificationPreferences.birthday = birthday;
    if (anniversary !== undefined) user.notificationPreferences.anniversary = anniversary;
    if (eventUpdates !== undefined) user.notificationPreferences.eventUpdates = eventUpdates;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get any member's public profile (for tree node click)
const getMemberProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select('username profileImage gender dob bloodGroup profession location phone socialLinks isDeceased deathYear');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  uploadProfileImage,
  getUserHistory,
  getUserNotifications,
  updateNotificationPreferences,
  getMemberProfile,
};