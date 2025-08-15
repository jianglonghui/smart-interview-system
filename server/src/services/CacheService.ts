import { redisService } from '../config/redis';
import { logger } from '../config/logger';

export class CacheService {
  private readonly keyPrefix = 'interview_system:';

  /**
   * Set a value in cache with optional TTL
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const prefixedKey = this.keyPrefix + key;
      await redisService.setJSON(prefixedKey, value, ttl);
      
      logger.debug('Cache set', { key: prefixedKey, ttl });
    } catch (error) {
      logger.error('Cache set failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const value = await redisService.getJSON<T>(prefixedKey);
      
      logger.debug('Cache get', { key: prefixedKey, hit: value !== null });
      return value;
    } catch (error) {
      logger.error('Cache get failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on cache read failures, just return null
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const result = await redisService.del(prefixedKey);
      
      logger.debug('Cache delete', { key: prefixedKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const result = await redisService.exists(prefixedKey);
      
      return result > 0;
    } catch (error) {
      logger.error('Cache exists check failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const result = await redisService.expire(prefixedKey, seconds);
      
      logger.debug('Cache expire set', { key: prefixedKey, seconds });
      return result;
    } catch (error) {
      logger.error('Cache expire failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  public async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Generate new value
      const value = await factory();
      
      // Set in cache
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error('Cache getOrSet failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  public async deletePattern(pattern: string): Promise<number> {
    try {
      const client = redisService.getClient();
      const prefixedPattern = this.keyPrefix + pattern;
      
      // Get all keys matching pattern
      const keys = await client.keys(prefixedPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const result = await client.del(keys);
      
      logger.info('Cache pattern delete', { 
        pattern: prefixedPattern, 
        keysDeleted: result 
      });
      
      return result;
    } catch (error) {
      logger.error('Cache pattern delete failed', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Cache for function results with automatic key generation
   */
  public async cached<T>(
    fn: Function,
    args: any[],
    options: {
      ttl?: number;
      keyPrefix?: string;
      keyGenerator?: (fn: Function, args: any[]) => string;
    } = {}
  ): Promise<T> {
    const keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    const key = `${options.keyPrefix || 'fn'}:${keyGenerator(fn, args)}`;
    
    return this.getOrSet(key, () => fn(...args), options.ttl);
  }

  /**
   * Increment a counter in cache
   */
  public async increment(key: string, value: number = 1, ttl?: number): Promise<number> {
    try {
      const client = redisService.getClient();
      const prefixedKey = this.keyPrefix + key;
      
      const result = await client.incrBy(prefixedKey, value);
      
      // Set TTL if this is the first increment and TTL is specified
      if (result === value && ttl) {
        await client.expire(prefixedKey, ttl);
      }
      
      logger.debug('Cache increment', { key: prefixedKey, value, result });
      return result;
    } catch (error) {
      logger.error('Cache increment failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store data in hash structure
   */
  public async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      const prefixedKey = this.keyPrefix + key;
      await redisService.hSet(prefixedKey, field, value);
      
      logger.debug('Cache hset', { key: prefixedKey, field });
    } catch (error) {
      logger.error('Cache hset failed', {
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get data from hash structure
   */
  public async hGet(key: string, field: string): Promise<string | null> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const result = await redisService.hGet(prefixedKey, field);
      
      logger.debug('Cache hget', { key: prefixedKey, field, hit: result !== undefined });
      return result || null;
    } catch (error) {
      logger.error('Cache hget failed', {
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all fields from hash structure
   */
  public async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const result = await redisService.hGetAll(prefixedKey);
      
      logger.debug('Cache hgetall', { key: prefixedKey, fields: Object.keys(result).length });
      return result;
    } catch (error) {
      logger.error('Cache hgetall failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * Clear all cache with current prefix
   */
  public async clear(): Promise<number> {
    return this.deletePattern('*');
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
    hitRate?: number;
  }> {
    try {
      const client = redisService.getClient();
      const keys = await client.keys(this.keyPrefix + '*');
      const info = await client.info('memory');
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(.+)\r?\n/);
      const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';
      
      return {
        totalKeys: keys.length,
        memoryUsed,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return {
        totalKeys: 0,
        memoryUsed: 'unknown',
      };
    }
  }

  /**
   * Default key generator for function caching
   */
  private defaultKeyGenerator(fn: Function, args: any[]): string {
    const fnName = fn.name || 'anonymous';
    const argsHash = this.hashArgs(args);
    return `${fnName}:${argsHash}`;
  }

  /**
   * Simple hash function for arguments
   */
  private hashArgs(args: any[]): string {
    const str = JSON.stringify(args);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export default CacheService;