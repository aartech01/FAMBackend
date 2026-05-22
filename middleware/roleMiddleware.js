// middleware/roleMiddleware.js
// Middleware to check if user is admin
export const isAdmin = async (req, res, next) => {
  try {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying admin access",
    });
  }
};

// Middleware to check if user is organizer
export const isOrganizer = async (req, res, next) => {
  try {
    if (req.user && req.user.role === "organizer") {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organizer only.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying organizer access",
    });
  }
};

// Middleware to check if user is regular user
export const isUser = async (req, res, next) => {
  try {
    if (req.user && req.user.role === "user") {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. User only.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying user access",
    });
  }
};

// Check if user is admin or organizer (for event management)
export const isAdminOrOrganizer = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === "admin" || req.user.role === "organizer")) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Organizer only.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying access",
    });
  }
};