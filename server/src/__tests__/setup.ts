// Test setup file

// Mock Redis client and service
jest.mock('../config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isReady: true,
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    on: jest.fn()
  },
  redisService: {
    setJSON: jest.fn(),
    getJSON: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    hSet: jest.fn(),
    hGet: jest.fn(),
    hGetAll: jest.fn(),
    getClient: jest.fn(() => ({
      keys: jest.fn(),
      del: jest.fn(),
      incrBy: jest.fn(),
      expire: jest.fn(),
      info: jest.fn()
    }))
  }
}));

// Mock Playwright browser
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          waitForSelector: jest.fn(),
          evaluate: jest.fn(),
          $$: jest.fn().mockResolvedValue([]),
          $eval: jest.fn(),
          close: jest.fn()
        }),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

// Mock logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['PORT'] = '3001';