import { Router, Request, Response } from 'express';
import { redisService } from '../config/redis';
import { logger } from '../config/logger';

const router = Router();

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    redis: 'connected' | 'disconnected' | 'error';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
  version: string;
}

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check Redis connection
    let redisStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      if (redisService.isReady()) {
        // Test Redis connection with a simple operation
        await redisService.set('health_check', 'ok', 5);
        redisStatus = 'connected';
      }
    } catch (error) {
      logger.error('Redis health check failed:', error);
      redisStatus = 'error';
    }

    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryInfo = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuInfo = {
      usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000), // Convert to milliseconds
    };

    const isHealthy = redisStatus === 'connected';
    const responseTime = Date.now() - startTime;

    const healthData: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        redis: redisStatus,
        memory: memoryInfo,
        cpu: cpuInfo,
      },
      version: '1.0.0',
    };

    // Log health check
    logger.info('Health check completed', {
      status: healthData.status,
      responseTime,
      redisStatus,
    });

    res.status(isHealthy ? 200 : 503).json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with more comprehensive system info
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Basic health data
    const basicHealth = await new Promise<HealthCheckResponse>((resolve, reject) => {
      // Reuse the basic health check logic
      router.stack[0]?.handle({ ...req, path: '/' } as Request, {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 200 || code === 503) {
              resolve(data);
            } else {
              reject(new Error('Health check failed'));
            }
          },
        }),
      } as any, () => {});
    }).catch(() => null);

    // Additional system information
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      freeMemory: Math.round(require('os').freemem() / 1024 / 1024), // MB
      totalMemory: Math.round(require('os').totalmem() / 1024 / 1024), // MB
    };

    // Test external dependencies
    const dependencies = {
      redis: basicHealth?.services.redis || 'unknown',
    };

    const responseTime = Date.now() - startTime;

    res.json({
      ...basicHealth,
      system: systemInfo,
      dependencies,
      performance: {
        responseTime,
        memoryLeaks: memoryLeakDetection(),
      },
      checks: [
        {
          name: 'Redis Connection',
          status: dependencies.redis,
          critical: true,
        },
        {
          name: 'Memory Usage',
          status: basicHealth?.services.memory.percentage ? 
            (basicHealth.services.memory.percentage > 90 ? 'warning' : 'ok') : 'unknown',
          critical: false,
        },
      ],
    });
  } catch (error) {
    logger.error('Detailed health check error:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness probe for Kubernetes/Docker
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const isRedisReady = redisService.isReady();
    
    if (isRedisReady) {
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Redis not ready',
      });
    }
  } catch (error) {
    logger.error('Readiness check error:', error);
    
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for Kubernetes/Docker
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - just return OK if the process is running
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Simple memory leak detection
 */
function memoryLeakDetection() {
  const usage = process.memoryUsage();
  const thresholds = {
    heapUsed: 500 * 1024 * 1024, // 500MB
    heapTotal: 1000 * 1024 * 1024, // 1GB
    external: 100 * 1024 * 1024, // 100MB
  };

  return {
    potential_leak: usage.heapUsed > thresholds.heapUsed,
    heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
    external_mb: Math.round(usage.external / 1024 / 1024),
  };
}

export default router;