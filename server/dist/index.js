"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config/config");
const logger_1 = require("./config/logger");
const rateLimiter_1 = require("./config/rateLimiter");
const pdf_1 = __importDefault(require("./routes/pdf"));
const crawler_1 = __importDefault(require("./routes/crawler"));
const health_1 = __importDefault(require("./routes/health"));
const interview_1 = __importDefault(require("./routes/interview"));
dotenv_1.default.config();
class Server {
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.ensureDirectories();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));
        this.app.use((0, cors_1.default)({
            origin: config_1.config.corsOrigin,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        }));
        this.app.use(rateLimiter_1.rateLimiter);
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((req, res, next) => {
            logger_1.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });
            next();
        });
    }
    setupRoutes() {
        this.app.use('/api/health', health_1.default);
        this.app.use('/api/pdf', pdf_1.default);
        this.app.use('/api/crawler', crawler_1.default);
        this.app.use('/api/interview', interview_1.default);
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                error: 'API endpoint not found',
                message: `The endpoint ${req.method} ${req.path} does not exist`,
            });
        });
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Interview System Backend API',
                version: '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString(),
            });
        });
    }
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            logger_1.logger.error('Unhandled error:', {
                error: err.message,
                stack: err.stack,
                path: req.path,
                method: req.method,
                ip: req.ip,
            });
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File too large',
                    message: `File size exceeds the limit of ${config_1.config.maxFileSize} bytes`,
                });
            }
            const status = err.status || 500;
            const message = config_1.config.nodeEnv === 'production'
                ? 'Internal server error'
                : err.message;
            res.status(status).json({
                error: 'Server error',
                message,
                ...(config_1.config.nodeEnv === 'development' && { stack: err.stack }),
            });
        });
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: `Route ${req.method} ${req.path} not found`,
            });
        });
    }
    ensureDirectories() {
        const dirs = [
            config_1.config.uploadDir,
            config_1.config.logDir,
        ];
        dirs.forEach(dir => {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
                logger_1.logger.info(`Created directory: ${dir}`);
            }
        });
    }
    start() {
        const port = config_1.config.port;
        this.httpServer.listen(port, () => {
            logger_1.logger.info(`🚀 Server started successfully`, {
                port,
                env: config_1.config.nodeEnv,
                timestamp: new Date().toISOString(),
            });
        });
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
    }
    shutdown() {
        logger_1.logger.info('Received shutdown signal, closing server...');
        this.httpServer.close(() => {
            logger_1.logger.info('Server closed successfully');
            process.exit(0);
        });
        setTimeout(() => {
            logger_1.logger.error('Force closing server due to timeout');
            process.exit(1);
        }, 30000);
    }
}
const server = new Server();
server.start();
exports.default = Server;
//# sourceMappingURL=index.js.map