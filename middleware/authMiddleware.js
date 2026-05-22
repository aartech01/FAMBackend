import jwt from "jsonwebtoken";

const verifyToken = async (req, res, next) => {

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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export { verifyToken };