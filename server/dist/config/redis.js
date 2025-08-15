"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
const logger_1 = require("./logger");
class RedisService {
    constructor() {
        this.isConnected = false;
        this.client = (0, redis_1.createClient)({
            url: config_1.config.redisUrl,
            password: config_1.config.redisPassword,
            database: config_1.config.redisDb,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger_1.logger.error('Redis reconnection failed after 10 attempts');
                        return false;
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
        });
        this.setupEventHandlers();
        this.connect();
    }
    setupEventHandlers() {
        this.client.on('error', (err) => {
            logger_1.logger.error('Redis client error:', err);
            this.isConnected = false;
        });
        this.client.on('connect', () => {
            logger_1.logger.info('Redis client connected');
        });
        this.client.on('ready', () => {
            logger_1.logger.info('Redis client ready');
            this.isConnected = true;
        });
        this.client.on('end', () => {
            logger_1.logger.info('Redis client disconnected');
            this.isConnected = false;
        });
        this.client.on('reconnecting', () => {
            logger_1.logger.info('Redis client reconnecting...');
        });
    }
    async connect() {
        try {
            await this.client.connect();
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
            this.isConnected = false;
            logger_1.logger.info('Redis client disconnected gracefully');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from Redis:', error);
        }
    }
    getClient() {
        return this.client;
    }
    isReady() {
        return this.isConnected;
    }
    async set(key, value, ttl) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            if (ttl) {
                await this.client.setEx(key, ttl, value);
            }
            else {
                await this.client.set(key, value);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error setting Redis key ${key}:`, error);
            throw error;
        }
    }
    async get(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.get(key);
        }
        catch (error) {
            logger_1.logger.error(`Error getting Redis key ${key}:`, error);
            throw error;
        }
    }
    async del(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.del(key);
        }
        catch (error) {
            logger_1.logger.error(`Error deleting Redis key ${key}:`, error);
            throw error;
        }
    }
    async exists(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.exists(key);
        }
        catch (error) {
            logger_1.logger.error(`Error checking Redis key ${key}:`, error);
            throw error;
        }
    }
    async expire(key, seconds) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.expire(key, seconds);
        }
        catch (error) {
            logger_1.logger.error(`Error setting expiration for Redis key ${key}:`, error);
            throw error;
        }
    }
    async setJSON(key, value, ttl) {
        const jsonValue = JSON.stringify(value);
        await this.set(key, jsonValue, ttl);
    }
    async getJSON(key) {
        const value = await this.get(key);
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch (error) {
            logger_1.logger.error(`Error parsing JSON from Redis key ${key}:`, error);
            throw error;
        }
    }
    async hSet(key, field, value) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.hSet(key, field, value);
        }
        catch (error) {
            logger_1.logger.error(`Error setting Redis hash ${key}:${field}:`, error);
            throw error;
        }
    }
    async hGet(key, field) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.hGet(key, field);
        }
        catch (error) {
            logger_1.logger.error(`Error getting Redis hash ${key}:${field}:`, error);
            throw error;
        }
    }
    async hGetAll(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            return await this.client.hGetAll(key);
        }
        catch (error) {
            logger_1.logger.error(`Error getting Redis hash ${key}:`, error);
            throw error;
        }
    }
}
exports.redisService = new RedisService();
exports.default = exports.redisService;
//# sourceMappingURL=redis.js.map