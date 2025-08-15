"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
class CacheService {
    constructor() {
        this.keyPrefix = 'interview_system:';
    }
    async set(key, value, ttl) {
        try {
            const prefixedKey = this.keyPrefix + key;
            await redis_1.redisService.setJSON(prefixedKey, value, ttl);
            logger_1.logger.debug('Cache set', { key: prefixedKey, ttl });
        }
        catch (error) {
            logger_1.logger.error('Cache set failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async get(key) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const value = await redis_1.redisService.getJSON(prefixedKey);
            logger_1.logger.debug('Cache get', { key: prefixedKey, hit: value !== null });
            return value;
        }
        catch (error) {
            logger_1.logger.error('Cache get failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async delete(key) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const result = await redis_1.redisService.del(prefixedKey);
            logger_1.logger.debug('Cache delete', { key: prefixedKey, deleted: result > 0 });
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error('Cache delete failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async exists(key) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const result = await redis_1.redisService.exists(prefixedKey);
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error('Cache exists check failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async expire(key, seconds) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const result = await redis_1.redisService.expire(prefixedKey, seconds);
            logger_1.logger.debug('Cache expire set', { key: prefixedKey, seconds });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache expire failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async getOrSet(key, factory, ttl) {
        try {
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }
            const value = await factory();
            await this.set(key, value, ttl);
            return value;
        }
        catch (error) {
            logger_1.logger.error('Cache getOrSet failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async deletePattern(pattern) {
        try {
            const client = redis_1.redisService.getClient();
            const prefixedPattern = this.keyPrefix + pattern;
            const keys = await client.keys(prefixedPattern);
            if (keys.length === 0) {
                return 0;
            }
            const result = await client.del(keys);
            logger_1.logger.info('Cache pattern delete', {
                pattern: prefixedPattern,
                keysDeleted: result
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache pattern delete failed', {
                pattern,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async cached(fn, args, options = {}) {
        const keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
        const key = `${options.keyPrefix || 'fn'}:${keyGenerator(fn, args)}`;
        return this.getOrSet(key, () => fn(...args), options.ttl);
    }
    async increment(key, value = 1, ttl) {
        try {
            const client = redis_1.redisService.getClient();
            const prefixedKey = this.keyPrefix + key;
            const result = await client.incrBy(prefixedKey, value);
            if (result === value && ttl) {
                await client.expire(prefixedKey, ttl);
            }
            logger_1.logger.debug('Cache increment', { key: prefixedKey, value, result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache increment failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async hSet(key, field, value) {
        try {
            const prefixedKey = this.keyPrefix + key;
            await redis_1.redisService.hSet(prefixedKey, field, value);
            logger_1.logger.debug('Cache hset', { key: prefixedKey, field });
        }
        catch (error) {
            logger_1.logger.error('Cache hset failed', {
                key,
                field,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async hGet(key, field) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const result = await redis_1.redisService.hGet(prefixedKey, field);
            logger_1.logger.debug('Cache hget', { key: prefixedKey, field, hit: result !== undefined });
            return result || null;
        }
        catch (error) {
            logger_1.logger.error('Cache hget failed', {
                key,
                field,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async hGetAll(key) {
        try {
            const prefixedKey = this.keyPrefix + key;
            const result = await redis_1.redisService.hGetAll(prefixedKey);
            logger_1.logger.debug('Cache hgetall', { key: prefixedKey, fields: Object.keys(result).length });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache hgetall failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            return {};
        }
    }
    async clear() {
        return this.deletePattern('*');
    }
    async getStats() {
        try {
            const client = redis_1.redisService.getClient();
            const keys = await client.keys(this.keyPrefix + '*');
            const info = await client.info('memory');
            const memoryMatch = info.match(/used_memory_human:(.+)\r?\n/);
            const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';
            return {
                totalKeys: keys.length,
                memoryUsed,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache stats', error);
            return {
                totalKeys: 0,
                memoryUsed: 'unknown',
            };
        }
    }
    defaultKeyGenerator(fn, args) {
        const fnName = fn.name || 'anonymous';
        const argsHash = this.hashArgs(args);
        return `${fnName}:${argsHash}`;
    }
    hashArgs(args) {
        const str = JSON.stringify(args);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
}
exports.CacheService = CacheService;
exports.default = CacheService;
//# sourceMappingURL=CacheService.js.map