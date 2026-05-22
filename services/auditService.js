// services/auditService.js
import Log from "../models/Log.js";

// Create a log entry
export const createLog = async ({ userId, role, action, module, metadata, ipAddress, userAgent }) => {
  try {
    const log = new Log({
      userId: userId,
      userModel: role === "admin" ? "Admin" : role === "organizer" ? "Organizer" : "User",
      role: role,
      action: action,
      module: module,
      metadata: metadata || {},
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });
    
    await log.save();
    return log;
  } catch (error) {
    console.error("Log creation error:", error);
    // Don't throw error - logging should not break the main flow
    return null;
  }
};

// Get logs with filters
export const getLogs = async (filters = {}, page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit;
    
    const query = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.role) query.role = filters.role;
    if (filters.action) query.action = filters.action;
    if (filters.module) query.module = filters.module;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Log.countDocuments(query),
    ]);
    
    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Get logs error:", error);
    return { logs: [], total: 0, page: 1, totalPages: 0 };
  }
};

// Get user action logs
export const getUserLogs = async (userId, page = 1, limit = 20) => {
  return await getLogs({ userId }, page, limit);
};

// Get logs by module
export const getModuleLogs = async (module, page = 1, limit = 50) => {
  return await getLogs({ module }, page, limit);
};

// Get recent logs
export const getRecentLogs = async (limit = 10) => {
  try {
    const logs = await Log.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    return logs;
  } catch (error) {
    console.error("Get recent logs error:", error);
    return [];
  }
};

// Delete old logs (for cleanup)
export const deleteOldLogs = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await Log.deleteMany({
      createdAt: { $lt: cutoffDate },
    });
    
    console.log(`Deleted ${result.deletedCount} logs older than ${daysOld} days`);
    return result.deletedCount;
  } catch (error) {
    console.error("Delete old logs error:", error);
    return 0;
  }
};