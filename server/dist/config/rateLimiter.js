"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.rateLimiter = exports.uploadRateLimitMiddleware = exports.crawlerRateLimitMiddleware = exports.generalRateLimiter = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const redis_1 = require("redis");
const config_1 = require("./config");
const logger_1 = require("./logger");
const redisClient = (0, redis_1.createClient)({
    url: config_1.config.redisUrl,
    password: config_1.config.redisPassword,
    database: config_1.config.redisDb,
});
exports.redisClient = redisClient;
redisClient.on('error', (err) => {
    logger_1.logger.error('Redis rate limiter connection error:', err);
});
redisClient.on('connect', () => {
    logger_1.logger.info('Redis rate limiter connected successfully');
});
redisClient.connect().catch((err) => {
    logger_1.logger.error('Failed to connect Redis for rate limiting:', err);
});
const rateLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'interview_system_rl',
    points: config_1.config.rateLimitMaxRequests,
    duration: Math.floor(config_1.config.rateLimitWindowMs / 1000),
    blockDuration: 300,
    execEvenly: true,
});
const crawlerRateLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'crawler_rl',
    points: 10,
    duration: 60,
    blockDuration: 600,
});
const uploadRateLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'upload_rl',
    points: 5,
    duration: 300,
    blockDuration: 900,
});
const createRateLimitMiddleware = (limiter, name) => {
    return async (req, res, next) => {
        try {
            const key = req.ip || req.connection.remoteAddress || 'unknown';
            await limiter.consume(key);
            next();
        }
        catch (rateLimiterRes) {
            const remainingTime = Math.round(rateLimiterRes.msBeforeNext / 1000);
            logger_1.logger.warn(`${name} rate limit exceeded`, {
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
exports.generalRateLimiter = createRateLimitMiddleware(rateLimiter, 'general');
exports.rateLimiter = exports.generalRateLimiter;
exports.crawlerRateLimitMiddleware = createRateLimitMiddleware(crawlerRateLimiter, 'crawler');
exports.uploadRateLimitMiddleware = createRateLimitMiddleware(uploadRateLimiter, 'upload');
exports.default = exports.generalRateLimiter;
//# sourceMappingURL=rateLimiter.js.map