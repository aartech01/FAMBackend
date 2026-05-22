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