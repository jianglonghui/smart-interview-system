"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const InterviewCrawlerService_1 = require("../services/InterviewCrawlerService");
const logger_1 = require("../config/logger");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
const crawlSchema = joi_1.default.object({
    category: joi_1.default.string().required().valid('前端开发', '后端开发', '算法岗', '测试开发', '运维开发', '产品经理', '数据分析'),
    keywords: joi_1.default.array().items(joi_1.default.string()).optional(),
    maxQuestions: joi_1.default.number().min(1).max(100).default(20),
    sites: joi_1.default.array().items(joi_1.default.string().valid('nowcoder', 'csdn', 'juejin')).optional()
});
(async () => {
    try {
        await InterviewCrawlerService_1.interviewCrawler.initialize();
        logger_1.logger.info('Interview crawler initialized');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize interview crawler:', error);
    }
})();
router.post('/crawl', async (req, res) => {
    try {
        const { error, value } = crawlSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        logger_1.logger.info('Crawling interview questions:', value);
        const result = await InterviewCrawlerService_1.interviewCrawler.crawlQuestions(value);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Crawl error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to crawl interview questions'
        });
    }
});
router.get('/categories', (req, res) => {
    res.json({
        success: true,
        categories: [
            { value: '前端开发', label: '前端开发', keywords: ['前端', 'javascript', 'react', 'vue'] },
            { value: '后端开发', label: '后端开发', keywords: ['后端', 'java', 'spring', 'mysql'] },
            { value: '算法岗', label: '算法岗', keywords: ['算法', 'leetcode', '数据结构'] },
            { value: '测试开发', label: '测试开发', keywords: ['测试', '自动化测试', 'selenium'] },
            { value: '运维开发', label: '运维开发', keywords: ['运维', 'devops', 'kubernetes'] },
            { value: '产品经理', label: '产品经理', keywords: ['产品', '需求分析', '用户体验'] },
            { value: '数据分析', label: '数据分析', keywords: ['数据分析', 'sql', 'python'] }
        ]
    });
});
router.get('/sites', (req, res) => {
    res.json({
        success: true,
        sites: [
            { value: 'nowcoder', label: '牛客网', enabled: true },
            { value: 'csdn', label: 'CSDN', enabled: true },
            { value: 'juejin', label: '掘金', enabled: true }
        ]
    });
});
process.on('SIGINT', async () => {
    await InterviewCrawlerService_1.interviewCrawler.cleanup();
});
exports.default = router;
//# sourceMappingURL=interview.js.map