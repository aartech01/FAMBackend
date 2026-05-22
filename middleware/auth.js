// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Organizer from "../models/Organizer.js";

const getModelByRole = (role) => {
  switch (role) {
    case "admin":
      return Admin;
    case "organizer":
      return Organizer;
    default:
      return User;
  }
};

export const verifyToken = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    // Remove Bearer
    token = token.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const Model = getModelByRole(decoded.role);
    const user = await Model.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    
    // Check if user is blocked (for regular users)
    if (decoded.role === "user" && user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked",
      });
    }
    
    // Check if organizer is active
    if (decoded.role === "organizer" && user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your organizer account is inactive",
      });
    }

    req.user = {
      id: user._id,
      name: user.name || user.username,
      email: user.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Simple verify without database check (for sockets or lightweight checks)
export const verifyTokenSimple = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};