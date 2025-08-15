import { createClient, RedisClientType } from 'redis';
import { config } from './config';
import { logger } from './logger';

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redisUrl,
      password: config.redisPassword,
      database: config.redisDb,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis client disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  // Cache methods
  public async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting Redis key ${key}:`, error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Error getting Redis key ${key}:`, error);
      throw error;
    }
  }

  public async del(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Error deleting Redis key ${key}:`, error);
      throw error;
    }
  }

  public async exists(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Error checking Redis key ${key}:`, error);
      throw error;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Error setting expiration for Redis key ${key}:`, error);
      throw error;
    }
  }

  // JSON methods
  public async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.set(key, jsonValue, ttl);
  }

  public async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Error parsing JSON from Redis key ${key}:`, error);
      throw error;
    }
  }

  // Hash methods
  public async hSet(key: string, field: string, value: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Error setting Redis hash ${key}:${field}:`, error);
      throw error;
    }
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}:${field}:`, error);
      throw error;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}:`, error);
      throw error;
    }
  }
}

// Create and export Redis service instance
export const redisService = new RedisService();

export default redisService;