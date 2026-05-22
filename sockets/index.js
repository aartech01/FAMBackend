// sockets/index.js
import jwt from "jsonwebtoken";

export const setupSocketIO = (io) => {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });
  
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Join user's personal room
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
    }
    
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};