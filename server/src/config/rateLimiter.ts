import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';

// Create Redis client for rate limiting
const redisClient = createClient({
  url: config.redisUrl,
  password: config.redisPassword,
  database: config.redisDb,
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limiter connection error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis rate limiter connected successfully');
});

// Initialize Redis connection
redisClient.connect().catch((err) => {
  logger.error('Failed to connect Redis for rate limiting:', err);
});

// Rate limiter configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'interview_system_rl',
  points: config.rateLimitMaxRequests, // Number of requests
  duration: Math.floor(config.rateLimitWindowMs / 1000), // Per duration in seconds
  blockDuration: 300, // Block for 5 minutes if limit exceeded
  execEvenly: true, // Spread requests evenly across duration
});

// Special rate limiter for crawler endpoints (more restrictive)
const crawlerRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'crawler_rl',
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
  blockDuration: 600, // Block for 10 minutes if limit exceeded
});

// Special rate limiter for file upload endpoints
const uploadRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'upload_rl',
  points: 5, // 5 uploads
  duration: 300, // per 5 minutes
  blockDuration: 900, // Block for 15 minutes if limit exceeded
});

// Middleware factory for different rate limiters
const createRateLimitMiddleware = (limiter: RateLimiterRedis, name: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use IP address as the key
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      
      await limiter.consume(key);
      next();
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const remainingTime = Math.round(rateLimiterRes.msBeforeNext / 1000);
      
      logger.warn(`${name} rate limit exceeded`, {
        ip: req.ip,
        path: req.path,
        remainingTime,
      });

      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded for ${name}. Try again in ${remainingTime} seconds.`,
        retryAfter: remainingTime,
      });
    }
  };
};

// Export middleware instances
export const generalRateLimiter = createRateLimitMiddleware(rateLimiter, 'general');
export const crawlerRateLimitMiddleware = createRateLimitMiddleware(crawlerRateLimiter, 'crawler');
export const uploadRateLimitMiddleware = createRateLimitMiddleware(uploadRateLimiter, 'upload');

// Default export is general rate limiter
export { generalRateLimiter as rateLimiter };

// Export Redis client for other services
export { redisClient };

export default generalRateLimiter;