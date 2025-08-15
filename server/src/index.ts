import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

// Import configurations
import { config } from './config/config';
import { logger } from './config/logger';
import { rateLimiter } from './config/rateLimiter';
import { initializeDatabase } from './config/database';

// Import routes
import pdfRoutes from './routes/pdf';
import crawlerRoutes from './routes/crawler';
import healthRoutes from './routes/health';
import interviewRoutes from './routes/interview';
import questionBankRoutes from './routes/questionBank';
import favoritesRoutes from './routes/favorites';

// Load environment variables
dotenv.config();

class Server {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.ensureDirectories();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check route
    this.app.use('/api/health', healthRoutes);

    // API routes
    this.app.use('/api/pdf', pdfRoutes);
    this.app.use('/api/crawler', crawlerRoutes);
    this.app.use('/api/interview', interviewRoutes);
    this.app.use('/api/question-bank', questionBankRoutes);
    this.app.use('/api/favorites', favoritesRoutes);

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: 'API endpoint not found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
      });
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Interview System Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((
      err: Error & { status?: number; code?: string },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      // Handle specific error types
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: `File size exceeds the limit of ${config.maxFileSize} bytes`,
        });
      }

      const status = err.status || 500;
      const message = config.nodeEnv === 'production' 
        ? 'Internal server error' 
        : err.message;

      res.status(status).json({
        error: 'Server error',
        message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
      });
    });

    // Handle 404 errors
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  private ensureDirectories(): void {
    const dirs = [
      config.uploadDir,
      config.logDir,
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize database
      await initializeDatabase();
      logger.info('Database initialized successfully');
      
      const port = config.port;
      
      this.httpServer.listen(port, () => {
        logger.info(`🚀 Server started successfully`, {
          port,
          env: config.nodeEnv,
          timestamp: new Date().toISOString(),
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private shutdown(): void {
    logger.info('Received shutdown signal, closing server...');
    
    this.httpServer.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Force closing server due to timeout');
      process.exit(1);
    }, 30000);
  }
}

// Start the server
const server = new Server();
server.start();

export default Server;