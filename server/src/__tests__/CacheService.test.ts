import { CacheService } from '../services/CacheService';
import { redisService } from '../config/redis';

// Mock Redis service
jest.mock('../config/redis');

const mockRedisService = redisService as jest.Mocked<typeof redisService>;

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockRedisService.getJSON = jest.fn();
    mockRedisService.setJSON = jest.fn();
    mockRedisService.del = jest.fn();
    mockRedisService.exists = jest.fn();
  });

  describe('get', () => {
    test('should return data when key exists', async () => {
      const testData = { test: 'value', number: 123 };
      mockRedisService.getJSON.mockResolvedValue(testData);

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisService.getJSON).toHaveBeenCalledWith('interview_system:test-key');
    });

    test('should return null when key does not exist', async () => {
      mockRedisService.getJSON.mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');

      expect(result).toBeNull();
      expect(mockRedisService.getJSON).toHaveBeenCalledWith('interview_system:non-existent-key');
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedisService.getJSON.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
      expect(mockRedisService.getJSON).toHaveBeenCalledWith('interview_system:error-key');
    });
  });

  describe('set', () => {
    test('should store data with expiration', async () => {
      const testData = { message: 'hello', count: 42 };
      const expiration = 3600; // 1 hour
      
      mockRedisService.setJSON.mockResolvedValue(undefined);

      await cacheService.set('test-key', testData, expiration);

      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:test-key',
        testData,
        expiration
      );
    });

    test('should store data without expiration when not provided', async () => {
      const testData = { value: 'test' };
      
      mockRedisService.setJSON.mockResolvedValue(undefined);

      await cacheService.set('test-key', testData);

      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:test-key',
        testData,
        undefined
      );
    });

    test('should handle Redis errors', async () => {
      const testData = { test: 'value' };
      mockRedisService.setJSON.mockRejectedValue(new Error('Redis set error'));

      await expect(cacheService.set('error-key', testData)).rejects.toThrow('Redis set error');
      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:error-key',
        testData,
        undefined
      );
    });
  });

  describe('delete', () => {
    test('should delete existing key', async () => {
      mockRedisService.del.mockResolvedValue(1); // 1 key deleted

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedisService.del).toHaveBeenCalledWith('interview_system:test-key');
    });

    test('should return false when key does not exist', async () => {
      mockRedisService.del.mockResolvedValue(0); // 0 keys deleted

      const result = await cacheService.delete('non-existent-key');

      expect(result).toBe(false);
      expect(mockRedisService.del).toHaveBeenCalledWith('interview_system:non-existent-key');
    });

    test('should handle Redis delete errors', async () => {
      mockRedisService.del.mockRejectedValue(new Error('Redis delete error'));

      await expect(cacheService.delete('error-key')).rejects.toThrow('Redis delete error');
      expect(mockRedisService.del).toHaveBeenCalledWith('interview_system:error-key');
    });
  });

  describe('exists', () => {
    test('should return true when key exists', async () => {
      mockRedisService.exists.mockResolvedValue(1);

      const result = await cacheService.exists('existing-key');

      expect(result).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith('interview_system:existing-key');
    });

    test('should return false when key does not exist', async () => {
      mockRedisService.exists.mockResolvedValue(0);

      const result = await cacheService.exists('non-existent-key');

      expect(result).toBe(false);
      expect(mockRedisService.exists).toHaveBeenCalledWith('interview_system:non-existent-key');
    });

    test('should handle Redis exists errors', async () => {
      mockRedisService.exists.mockRejectedValue(new Error('Redis exists error'));

      const result = await cacheService.exists('error-key');

      expect(result).toBe(false);
    });
  });

  describe('getOrSet pattern', () => {
    test('should return cached value if exists', async () => {
      const cachedValue = { cached: true };
      mockRedisService.getJSON.mockResolvedValue(cachedValue);

      const factory = jest.fn().mockResolvedValue({ fresh: true });
      const result = await cacheService.getOrSet('test-key', factory, 3600);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
      expect(mockRedisService.getJSON).toHaveBeenCalledWith('interview_system:test-key');
    });

    test('should generate and cache value if not exists', async () => {
      const freshValue = { fresh: true };
      mockRedisService.getJSON.mockResolvedValue(null);
      mockRedisService.setJSON.mockResolvedValue(undefined);

      const factory = jest.fn().mockResolvedValue(freshValue);
      const result = await cacheService.getOrSet('test-key', factory, 3600);

      expect(result).toEqual(freshValue);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisService.getJSON).toHaveBeenCalledWith('interview_system:test-key');
      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:test-key',
        freshValue,
        3600
      );
    });
  });

  describe('edge cases', () => {
    test('should handle null and undefined values', async () => {
      mockRedisService.setJSON.mockResolvedValue(undefined);
      
      await cacheService.set('null-key', null);
      await cacheService.set('undefined-key', undefined);

      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:null-key',
        null,
        undefined
      );
      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:undefined-key',
        undefined,
        undefined
      );
    });

    test('should handle complex nested objects', async () => {
      const complexData = {
        user: {
          id: 123,
          profile: {
            name: 'Test User',
            tags: ['developer', 'tester']
          }
        },
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          flags: [true, false, true]
        }
      };

      mockRedisService.setJSON.mockResolvedValue(undefined);
      mockRedisService.getJSON.mockResolvedValue(complexData);

      await cacheService.set('complex-key', complexData, 1800);
      const retrieved = await cacheService.get('complex-key');

      expect(retrieved).toEqual(complexData);
      expect(mockRedisService.setJSON).toHaveBeenCalledWith(
        'interview_system:complex-key',
        complexData,
        1800
      );
    });
  });
});