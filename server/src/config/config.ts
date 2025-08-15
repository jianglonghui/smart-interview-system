import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  corsOrigin: string;

  // Redis
  redisUrl: string;
  redisPassword?: string;
  redisDb: number;

  // API Keys
  glmApiKey?: string;
  openaiApiKey?: string;

  // Crawler
  crawlerTimeout: number;
  crawlerMaxRetries: number;
  crawlerDelay: number;
  crawlerUserAgent: string;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // File Upload
  maxFileSize: number;
  uploadDir: string;

  // Security
  jwtSecret?: string;

  // Logging
  logLevel: string;
  logDir: string;
}

export const config: Config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Redis Configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD,
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),

  // API Keys
  glmApiKey: process.env.GLM_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Crawler Configuration
  crawlerTimeout: parseInt(process.env.CRAWLER_TIMEOUT || '30000', 10),
  crawlerMaxRetries: parseInt(process.env.CRAWLER_MAX_RETRIES || '3', 10),
  crawlerDelay: parseInt(process.env.CRAWLER_DELAY || '1000', 10),
  crawlerUserAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (compatible; InterviewSystemCrawler/1.0)',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),

  // Security
  jwtSecret: process.env.JWT_SECRET,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
};

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = [
    { key: 'GLM_API_KEY', value: config.glmApiKey, message: 'GLM API key is required for AI services' },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:');
    missingVars.forEach(({ key, message }) => {
      console.warn(`   - ${key}: ${message}`);
    });
    console.warn('   Please check your .env file or environment configuration.');
  }
}

export default config;