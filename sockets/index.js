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

    // Allow clients to subscribe to a specific event's tree room.
    // Emitting 'join_event_room' with an eventId joins room event_<id>,
    // so tree_update broadcasts reach all viewers without per-user iteration.
    socket.on("join_event_room", (eventId) => {
      if (eventId) socket.join(`event_${eventId}`);
    });

    socket.on("leave_event_room", (eventId) => {
      if (eventId) socket.leave(`event_${eventId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};