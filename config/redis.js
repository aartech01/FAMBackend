// config/redis.js
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 10) return null; // stop retrying — Railway will restart the process
        return Math.min(times * 100, 3000);
      },
    });
    
    redisClient.on("connect", () => {
      console.log("Redis connected successfully");
    });
    
    redisClient.on("error", (err) => {
      console.error("Redis error:", err);
    });
    
    return redisClient;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    return null;
  }
};

export const getRedisClient = () => {
  if (!redisClient) throw new Error('Redis client not initialized');
  return redisClient;
};