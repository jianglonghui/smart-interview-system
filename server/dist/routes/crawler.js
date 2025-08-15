"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../config/logger");
const rateLimiter_1 = require("../config/rateLimiter");
const CrawlerService_1 = require("../services/CrawlerService");
const CacheService_1 = require("../services/CacheService");
const router = (0, express_1.Router)();
const crawlerService = new CrawlerService_1.CrawlerService();
const cacheService = new CacheService_1.CacheService();
const crawlJobSchema = joi_1.default.object({
    url: joi_1.default.string().uri().required().messages({
        'string.uri': 'URL格式无效',
        'any.required': 'URL是必填字段',
    }),
    platform: joi_1.default.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
    options: joi_1.default.object({
        maxPages: joi_1.default.number().integer().min(1).max(10).default(1),
        delay: joi_1.default.number().integer().min(1000).max(10000).default(2000),
        includeDescription: joi_1.default.boolean().default(true),
        includeRequirements: joi_1.default.boolean().default(true),
        timeout: joi_1.default.number().integer().min(5000).max(60000).default(30000),
    }).default({}),
});
const batchCrawlSchema = joi_1.default.object({
    urls: joi_1.default.array().items(joi_1.default.string().uri()).min(1).max(5).required(),
    platform: joi_1.default.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
    options: joi_1.default.object({
        maxPages: joi_1.default.number().integer().min(1).max(5).default(1),
        delay: joi_1.default.number().integer().min(1000).max(10000).default(2000),
        includeDescription: joi_1.default.boolean().default(true),
        includeRequirements: joi_1.default.boolean().default(true),
        timeout: joi_1.default.number().integer().min(5000).max(60000).default(30000),
    }).default({}),
});
router.post('/job', rateLimiter_1.crawlerRateLimitMiddleware, async (req, res) => {
    try {
        const { error, value } = crawlJobSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: error.details[0]?.message || '请求参数无效',
            });
        }
        const { url, platform, options } = value;
        const startTime = Date.now();
        logger_1.logger.info('Starting job crawl', {
            url,
            platform,
            options,
            ip: req.ip,
        });
        const cacheKey = `job:${Buffer.from(url).toString('base64')}`;
        const cachedResult = await cacheService.get(cacheKey);
        if (cachedResult) {
            logger_1.logger.info('Returning cached job data', {
                url,
                cacheKey,
                processingTime: Date.now() - startTime,
            });
            return res.json({
                success: true,
                data: cachedResult,
                cached: true,
                processingTime: Date.now() - startTime,
            });
        }
        const result = await crawlerService.crawlJob(url, platform, options);
        const processingTime = Date.now() - startTime;
        await cacheService.set(cacheKey, result, 3600);
        logger_1.logger.info('Job crawl completed successfully', {
            url,
            platform,
            jobTitle: result.title,
            company: result.company,
            processingTime,
        });
        res.json({
            success: true,
            data: result,
            cached: false,
            processingTime,
        });
    }
    catch (error) {
        const processingTime = Date.now() - Date.now();
        logger_1.logger.error('Job crawl failed', {
            url: req.body.url,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ip: req.ip,
            processingTime,
        });
        res.status(500).json({
            success: false,
            error: 'Crawl failed',
            message: error instanceof Error ? error.message : '爬取失败',
            processingTime,
        });
    }
});
router.post('/jobs/batch', rateLimiter_1.crawlerRateLimitMiddleware, async (req, res) => {
    try {
        const { error, value } = batchCrawlSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: error.details[0]?.message || '请求参数无效',
            });
        }
        const { urls, platform, options } = value;
        const startTime = Date.now();
        logger_1.logger.info('Starting batch job crawl', {
            urls,
            platform,
            options,
            count: urls.length,
            ip: req.ip,
        });
        const results = await crawlerService.crawlJobsBatch(urls, platform, options);
        const processingTime = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        logger_1.logger.info('Batch job crawl completed', {
            totalJobs: urls.length,
            successCount,
            failureCount,
            processingTime,
        });
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: urls.length,
                    successful: successCount,
                    failed: failureCount,
                },
            },
            processingTime,
        });
    }
    catch (error) {
        const processingTime = Date.now() - Date.now();
        logger_1.logger.error('Batch job crawl failed', {
            urls: req.body.urls,
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip,
            processingTime,
        });
        res.status(500).json({
            success: false,
            error: 'Batch crawl failed',
            message: error instanceof Error ? error.message : '批量爬取失败',
            processingTime,
        });
    }
});
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'Missing job ID',
                message: '缺少作业ID',
            });
        }
        const status = await cacheService.get(`job_status:${jobId}`);
        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Job not found',
                message: '找不到指定的爬取作业',
            });
        }
        res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get crawl status', {
            jobId: req.params.jobId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Status check failed',
            message: '获取状态失败',
        });
    }
});
router.get('/platforms', (req, res) => {
    const platforms = [
        {
            id: 'zhipin',
            name: 'BOSS直聘',
            domain: 'zhipin.com',
            features: ['job_details', 'company_info', 'requirements'],
            limitations: ['需要反爬虫处理', '可能需要登录'],
        },
        {
            id: 'liepin',
            name: '猎聘网',
            domain: 'liepin.com',
            features: ['job_details', 'company_info', 'salary_info'],
            limitations: ['部分信息需要登录', '访问频率限制'],
        },
        {
            id: 'lagou',
            name: '拉勾网',
            domain: 'lagou.com',
            features: ['job_details', 'company_info', 'tech_stack'],
            limitations: ['严格的反爬虫机制', '需要验证码处理'],
        },
        {
            id: '51job',
            name: '前程无忧',
            domain: '51job.com',
            features: ['job_details', 'company_info', 'location_info'],
            limitations: ['部分页面需要登录', 'IP限制'],
        },
        {
            id: 'generic',
            name: '通用爬虫',
            domain: '*',
            features: ['basic_content', 'structured_data'],
            limitations: ['功能有限', '需要手动配置选择器'],
        },
    ];
    res.json({
        success: true,
        data: {
            platforms,
            recommendations: [
                '建议使用通用爬虫模式进行测试',
                '各平台可能有反爬虫机制，请合理使用',
                '遵守网站的robots.txt和使用条款',
            ],
        },
    });
});
router.get('/health', async (req, res) => {
    try {
        const health = await crawlerService.healthCheck();
        res.json({
            success: true,
            data: health,
        });
    }
    catch (error) {
        logger_1.logger.error('Crawler health check failed', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: '爬虫服务健康检查失败',
        });
    }
});
router.delete('/cache', async (req, res) => {
    try {
        const { pattern } = req.query;
        if (pattern && typeof pattern === 'string') {
            await cacheService.deletePattern(pattern);
            logger_1.logger.info('Cache cleared with pattern', { pattern });
        }
        else {
            await cacheService.deletePattern('job:*');
            await cacheService.deletePattern('job_status:*');
            logger_1.logger.info('All crawler cache cleared');
        }
        res.json({
            success: true,
            message: '缓存已清除',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to clear cache', error);
        res.status(500).json({
            success: false,
            error: 'Cache clear failed',
            message: '清除缓存失败',
        });
    }
});
exports.default = router;
//# sourceMappingURL=crawler.js.map