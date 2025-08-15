"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const startTime = Date.now();
        let redisStatus = 'disconnected';
        try {
            if (redis_1.redisService.isReady()) {
                await redis_1.redisService.set('health_check', 'ok', 5);
                redisStatus = 'connected';
            }
        }
        catch (error) {
            logger_1.logger.error('Redis health check failed:', error);
            redisStatus = 'error';
        }
        const memUsage = process.memoryUsage();
        const memoryInfo = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        };
        const cpuUsage = process.cpuUsage();
        const cpuInfo = {
            usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000),
        };
        const isHealthy = redisStatus === 'connected';
        const responseTime = Date.now() - startTime;
        const healthData = {
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
        logger_1.logger.info('Health check completed', {
            status: healthData.status,
            responseTime,
            redisStatus,
        });
        res.status(isHealthy ? 200 : 503).json(healthData);
    }
    catch (error) {
        logger_1.logger.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/detailed', async (req, res) => {
    try {
        const startTime = Date.now();
        const basicHealth = await new Promise((resolve, reject) => {
            router.stack[0]?.handle({ ...req, path: '/' }, {
                status: (code) => ({
                    json: (data) => {
                        if (code === 200 || code === 503) {
                            resolve(data);
                        }
                        else {
                            reject(new Error('Health check failed'));
                        }
                    },
                }),
            }, () => { });
        }).catch(() => null);
        const systemInfo = {
            platform: process.platform,
            nodeVersion: process.version,
            pid: process.pid,
            environment: process.env.NODE_ENV || 'development',
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
            freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
            totalMemory: Math.round(require('os').totalmem() / 1024 / 1024),
        };
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
    }
    catch (error) {
        logger_1.logger.error('Detailed health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Detailed health check failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/ready', async (req, res) => {
    try {
        const isRedisReady = redis_1.redisService.isReady();
        if (isRedisReady) {
            res.status(200).json({
                ready: true,
                timestamp: new Date().toISOString(),
            });
        }
        else {
            res.status(503).json({
                ready: false,
                timestamp: new Date().toISOString(),
                reason: 'Redis not ready',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Readiness check error:', error);
        res.status(503).json({
            ready: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/live', (req, res) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
function memoryLeakDetection() {
    const usage = process.memoryUsage();
    const thresholds = {
        heapUsed: 500 * 1024 * 1024,
        heapTotal: 1000 * 1024 * 1024,
        external: 100 * 1024 * 1024,
    };
    return {
        potential_leak: usage.heapUsed > thresholds.heapUsed,
        heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
        external_mb: Math.round(usage.external / 1024 / 1024),
    };
}
exports.default = router;
//# sourceMappingURL=health.js.map