import { Router, Request, Response } from 'express';
import { interviewCrawler } from '../services/InterviewCrawlerService';
import { logger } from '../config/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const crawlSchema = Joi.object({
  category: Joi.string().required().valid(
    '前端开发', '后端开发', '算法岗', '测试开发', 
    '运维开发', '产品经理', '数据分析'
  ),
  keywords: Joi.array().items(Joi.string()).optional(),
  maxQuestions: Joi.number().min(1).max(100).default(20),
  targetSites: Joi.array().items(Joi.string().valid('nowcoder', 'csdn', 'juejin')).min(1).required()
});

// Initialize crawler on startup
(async () => {
  try {
    await interviewCrawler.initialize();
    logger.info('Interview crawler initialized');
  } catch (error) {
    logger.error('Failed to initialize interview crawler:', error);
  }
})();

/**
 * POST /api/interview/crawl
 * Crawl interview questions from multiple sources
 */
router.post('/crawl', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = crawlSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    logger.info('Crawling interview questions:', value);

    // Perform crawl
    const result = await interviewCrawler.crawlQuestions(value);

    // Return result
    res.json(result);
  } catch (error) {
    logger.error('Crawl error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to crawl interview questions'
    });
  }
});

/**
 * GET /api/interview/categories
 * Get available categories
 */
router.get('/categories', (req: Request, res: Response) => {
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

/**
 * GET /api/interview/sites
 * Get available crawl sites
 */
router.get('/sites', (req: Request, res: Response) => {
  res.json({
    success: true,
    sites: [
      { value: 'nowcoder', label: '牛客网', enabled: true },
      { value: 'csdn', label: 'CSDN', enabled: true },
      { value: 'juejin', label: '掘金', enabled: true }
    ]
  });
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
  await interviewCrawler.cleanup();
});

export default router;