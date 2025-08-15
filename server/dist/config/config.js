"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseInt(process.env.REDIS_DB || '0', 10),
    glmApiKey: process.env.GLM_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    crawlerTimeout: parseInt(process.env.CRAWLER_TIMEOUT || '30000', 10),
    crawlerMaxRetries: parseInt(process.env.CRAWLER_MAX_RETRIES || '3', 10),
    crawlerDelay: parseInt(process.env.CRAWLER_DELAY || '1000', 10),
    crawlerUserAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (compatible; InterviewSystemCrawler/1.0)',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    uploadDir: process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), 'uploads'),
    jwtSecret: process.env.JWT_SECRET,
    logLevel: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || path_1.default.join(process.cwd(), 'logs'),
};
function validateConfig() {
    const requiredVars = [
        { key: 'GLM_API_KEY', value: exports.config.glmApiKey, message: 'GLM API key is required for AI services' },
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
exports.default = exports.config;
//# sourceMappingURL=config.js.map