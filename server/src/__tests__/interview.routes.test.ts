import request from 'supertest';
import express from 'express';
import interviewRouter from '../routes/interview';
import { interviewCrawler } from '../services/InterviewCrawlerService';

// Mock the InterviewCrawlerService
jest.mock('../services/InterviewCrawlerService', () => ({
  interviewCrawler: {
    initialize: jest.fn(),
    crawlQuestions: jest.fn(),
    cleanup: jest.fn()
  }
}));

const mockInterviewCrawler = interviewCrawler as jest.Mocked<typeof interviewCrawler>;

describe('Interview Routes', () => {
  let app: express.Application;
  
  const validCrawlOptions = {
    category: '前端开发',
    maxQuestions: 5,
    targetSites: ['nowcoder', 'csdn']
  };

  const mockCrawlResult = {
    success: true,
    questions: [
      {
        id: 'test-1',
        question: 'JavaScript闭包的概念是什么？',
        category: '前端开发',
        difficulty: 'medium' as const,
        type: '技术问题',
        source: '牛客网',
        company: '阿里巴巴',
        tags: ['javascript', '闭包'],
        url: 'https://test.com/question/1',
        crawledAt: '2025-08-14T13:13:14.770Z' // Use string instead of Date object
      }
    ],
    source: 'nowcoder, csdn',
    timestamp: 1755176449409 // Fixed timestamp
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interview', interviewRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/interview/crawl', () => {

    test('should successfully crawl questions with valid options', async () => {
      mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

      const response = await request(app)
        .post('/api/interview/crawl')
        .send(validCrawlOptions);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCrawlResult);
      expect(mockInterviewCrawler.crawlQuestions).toHaveBeenCalledWith({
        category: '前端开发',
        maxQuestions: 5,
        targetSites: ['nowcoder', 'csdn']
      });
    });

    test('should handle crawler service errors', async () => {
      mockInterviewCrawler.crawlQuestions.mockRejectedValue(new Error('Crawl failed'));

      const response = await request(app)
        .post('/api/interview/crawl')
        .send(validCrawlOptions);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to crawl interview questions'
      });
    });

    describe('validation tests', () => {
      test('should reject invalid category', async () => {
        const invalidOptions = {
          ...validCrawlOptions,
          category: '无效分类'
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('must be one of');
      });

      test('should reject missing category', async () => {
        const invalidOptions = {
          maxQuestions: 5,
          targetSites: ['nowcoder']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('category');
      });

      test('should reject invalid maxQuestions (too low)', async () => {
        const invalidOptions = {
          ...validCrawlOptions,
          maxQuestions: 0
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('must be greater than or equal to 1');
      });

      test('should reject invalid maxQuestions (too high)', async () => {
        const invalidOptions = {
          ...validCrawlOptions,
          maxQuestions: 200
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('must be less than or equal to 100');
      });

      test('should reject invalid targetSites', async () => {
        const invalidOptions = {
          ...validCrawlOptions,
          targetSites: ['invalid_site']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('must be one of');
      });

      test('should reject empty targetSites', async () => {
        const invalidOptions = {
          ...validCrawlOptions,
          targetSites: []
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(invalidOptions);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('must contain at least 1 items');
      });

      test('should accept optional keywords', async () => {
        mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

        const optionsWithKeywords = {
          ...validCrawlOptions,
          keywords: ['react', 'vue', 'javascript']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(optionsWithKeywords);

        expect(response.status).toBe(200);
        expect(mockInterviewCrawler.crawlQuestions).toHaveBeenCalledWith({
          category: '前端开发',
          maxQuestions: 5,
          targetSites: ['nowcoder', 'csdn'],
          keywords: ['react', 'vue', 'javascript']
        });
      });

      test('should use default maxQuestions when not provided', async () => {
        mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

        const optionsWithoutMaxQuestions = {
          category: '前端开发',
          targetSites: ['nowcoder']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(optionsWithoutMaxQuestions);

        expect(response.status).toBe(200);
        expect(mockInterviewCrawler.crawlQuestions).toHaveBeenCalledWith({
          category: '前端开发',
          maxQuestions: 20, // Default value
          targetSites: ['nowcoder']
        });
      });
    });

    describe('category validation', () => {
      const validCategories = [
        '前端开发',
        '后端开发',
        '算法岗',
        '测试开发',
        '运维开发',
        '产品经理',
        '数据分析'
      ];

      test.each(validCategories)('should accept valid category: %s', async (category) => {
        mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

        const options = {
          category,
          maxQuestions: 5,
          targetSites: ['nowcoder']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(options);

        expect(response.status).toBe(200);
      });
    });

    describe('targetSites validation', () => {
      const validSites = ['nowcoder', 'csdn', 'juejin'];

      test.each(validSites)('should accept valid site: %s', async (site) => {
        mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

        const options = {
          category: '前端开发',
          maxQuestions: 5,
          targetSites: [site]
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(options);

        expect(response.status).toBe(200);
      });

      test('should accept multiple valid sites', async () => {
        mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

        const options = {
          category: '前端开发',
          maxQuestions: 5,
          targetSites: ['nowcoder', 'csdn', 'juejin']
        };

        const response = await request(app)
          .post('/api/interview/crawl')
          .send(options);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('GET /api/interview/categories', () => {
    test('should return available categories', async () => {
      const response = await request(app)
        .get('/api/interview/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.categories).toBeInstanceOf(Array);
      expect(response.body.categories.length).toBe(7);

      // Check structure of first category
      const firstCategory = response.body.categories[0];
      expect(firstCategory).toHaveProperty('value', '前端开发');
      expect(firstCategory).toHaveProperty('label', '前端开发');
      expect(firstCategory).toHaveProperty('keywords');
      expect(firstCategory.keywords).toContain('前端');
      expect(firstCategory.keywords).toContain('javascript');
    });

    test('should return all expected categories', async () => {
      const response = await request(app)
        .get('/api/interview/categories');

      const categoryValues = response.body.categories.map((cat: any) => cat.value);
      const expectedCategories = [
        '前端开发',
        '后端开发',
        '算法岗',
        '测试开发',
        '运维开发',
        '产品经理',
        '数据分析'
      ];

      expectedCategories.forEach(category => {
        expect(categoryValues).toContain(category);
      });
    });
  });

  describe('GET /api/interview/sites', () => {
    test('should return available crawl sites', async () => {
      const response = await request(app)
        .get('/api/interview/sites');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sites).toBeInstanceOf(Array);
      expect(response.body.sites.length).toBe(3);

      // Check structure of first site
      const firstSite = response.body.sites[0];
      expect(firstSite).toHaveProperty('value', 'nowcoder');
      expect(firstSite).toHaveProperty('label', '牛客网');
      expect(firstSite).toHaveProperty('enabled', true);
    });

    test('should return all expected sites', async () => {
      const response = await request(app)
        .get('/api/interview/sites');

      const siteValues = response.body.sites.map((site: any) => site.value);
      const expectedSites = ['nowcoder', 'csdn', 'juejin'];

      expectedSites.forEach(site => {
        expect(siteValues).toContain(site);
      });
    });

    test('should have correct site labels', async () => {
      const response = await request(app)
        .get('/api/interview/sites');

      const sites = response.body.sites;
      const siteMap = sites.reduce((acc: any, site: any) => {
        acc[site.value] = site.label;
        return acc;
      }, {});

      expect(siteMap['nowcoder']).toBe('牛客网');
      expect(siteMap['csdn']).toBe('CSDN');
      expect(siteMap['juejin']).toBe('掘金');
    });
  });

  describe('error handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/interview/crawl')
        .send('invalid json')
        .type('json');

      expect(response.status).toBe(400);
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/interview/crawl')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle content-type not application/json', async () => {
      const response = await request(app)
        .post('/api/interview/crawl')
        .send('category=前端开发&maxQuestions=5')
        .type('form');

      expect(response.status).toBe(400);
    });
  });

  describe('integration scenarios', () => {
    test('should handle typical user workflow', async () => {
      // 1. Get categories
      const categoriesResponse = await request(app)
        .get('/api/interview/categories');
      
      expect(categoriesResponse.status).toBe(200);
      const categories = categoriesResponse.body.categories;
      
      // 2. Get sites
      const sitesResponse = await request(app)
        .get('/api/interview/sites');
      
      expect(sitesResponse.status).toBe(200);
      const sites = sitesResponse.body.sites;
      
      // 3. Crawl questions using data from previous calls
      mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);
      
      const crawlOptions = {
        category: categories[0].value,
        maxQuestions: 10,
        targetSites: sites.slice(0, 2).map((s: any) => s.value),
        keywords: categories[0].keywords.slice(0, 2)
      };
      
      const crawlResponse = await request(app)
        .post('/api/interview/crawl')
        .send(crawlOptions);
      
      expect(crawlResponse.status).toBe(200);
      expect(crawlResponse.body.success).toBe(true);
    });

    test('should handle concurrent crawl requests', async () => {
      mockInterviewCrawler.crawlQuestions.mockResolvedValue(mockCrawlResult);

      const promises = Array.from({ length: 3 }, (_, i) => 
        request(app)
          .post('/api/interview/crawl')
          .send({
            category: '前端开发',
            maxQuestions: 5,
            targetSites: ['nowcoder']
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockInterviewCrawler.crawlQuestions).toHaveBeenCalledTimes(3);
    });
  });
});