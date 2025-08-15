# 面试真题爬取实施方案

## 一、项目爬取需求分析

### 1.1 核心需求特点
- **目标明确**：爬取面试真题，非通用网页内容
- **数据源集中**：主要来自牛客网、CSDN、掘金等技术社区
- **实时性要求低**：面试题不频繁更新，可大量缓存
- **质量要求高**：需要准确提取问题，避免噪音数据
- **按需爬取**：根据岗位类别精准获取相关题目

### 1.2 当前问题分析
```javascript
// 现有代码问题：
1. CORS限制：浏览器端直接发起请求被阻止
2. 代理失效：allorigins.win等公共代理被目标网站识别
3. 反爬保护：目标网站有User-Agent检测、频率限制等
4. 架构问题：前端直接爬取不是最佳实践
```

## 二、技术架构方案

### 2.1 推荐架构：前后端分离 + 爬虫服务

```mermaid
graph TD
    A[React前端] -->|API请求| B[Node.js后端]
    B -->|任务分发| C[爬虫服务]
    C -->|Playwright| D[目标网站]
    C -->|备用API| E[ScraperAPI]
    B <-->|缓存| F[Redis]
    B <-->|存储| G[PostgreSQL]
    C -->|队列| H[Bull Queue]
```

### 2.2 核心组件设计

#### 后端API服务
```typescript
// src/server/api/crawler.ts
import express from 'express';
import { CrawlerService } from '../services/crawler';
import { CacheService } from '../services/cache';
import { QueueService } from '../services/queue';

const router = express.Router();

// 爬取面试题API
router.post('/api/crawl/questions', async (req, res) => {
  const { category, keywords, maxQuestions = 20 } = req.body;
  
  // 1. 检查缓存
  const cacheKey = `questions:${category}:${keywords.join(',')}`;
  const cached = await CacheService.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, source: 'cache' });
  }
  
  // 2. 创建爬取任务
  const job = await QueueService.addJob('crawl-questions', {
    category,
    keywords,
    maxQuestions
  });
  
  // 3. 等待结果或返回任务ID
  if (req.query.async === 'true') {
    return res.json({ success: true, jobId: job.id });
  }
  
  const result = await job.finished();
  
  // 4. 缓存结果（24小时）
  await CacheService.set(cacheKey, result, 86400);
  
  return res.json({ success: true, data: result });
});

// 获取任务状态
router.get('/api/crawl/job/:id', async (req, res) => {
  const job = await QueueService.getJob(req.params.id);
  const state = await job.getState();
  const progress = job.progress();
  
  res.json({ 
    id: job.id,
    state,
    progress,
    result: state === 'completed' ? await job.finished() : null
  });
});
```

#### 爬虫服务实现
```typescript
// src/server/services/crawler/index.ts
import { chromium, Browser, Page } from 'playwright';
import { ScraperAPIClient } from './scraperapi';

export class CrawlerService {
  private browser: Browser | null = null;
  private scraperAPI: ScraperAPIClient;
  
  constructor() {
    this.scraperAPI = new ScraperAPIClient(process.env.SCRAPER_API_KEY!);
  }
  
  async initialize() {
    // 启动无头浏览器
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });
  }
  
  async crawlQuestions(options: CrawlOptions) {
    const results: CrawledQuestion[] = [];
    
    // 策略1：使用Playwright爬取
    try {
      const page = await this.browser!.newPage();
      
      // 设置真实的浏览器环境
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      });
      
      // 针对不同网站的爬取策略
      if (options.site === 'nowcoder') {
        results.push(...await this.crawlNowcoder(page, options));
      } else if (options.site === 'csdn') {
        results.push(...await this.crawlCSDN(page, options));
      }
      
      await page.close();
    } catch (error) {
      console.error('Playwright爬取失败，切换到备用方案', error);
      
      // 策略2：使用ScraperAPI作为备用
      const apiResults = await this.scraperAPI.scrape(options);
      results.push(...apiResults);
    }
    
    return this.processResults(results);
  }
  
  private async crawlNowcoder(page: Page, options: CrawlOptions) {
    const questions: CrawledQuestion[] = [];
    
    // 访问牛客网
    await page.goto('https://www.nowcoder.com/discuss/tag/639', {
      waitUntil: 'networkidle'
    });
    
    // 等待内容加载
    await page.waitForSelector('.discuss-list', { timeout: 10000 });
    
    // 滚动加载更多内容
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
    
    // 提取面试题
    const items = await page.$$eval('.discuss-item', elements => {
      return elements.map(el => ({
        title: el.querySelector('.discuss-title')?.textContent?.trim(),
        content: el.querySelector('.discuss-brief')?.textContent?.trim(),
        tags: Array.from(el.querySelectorAll('.tag')).map(tag => tag.textContent?.trim()),
        company: el.querySelector('.company-tag')?.textContent?.trim(),
        url: el.querySelector('a')?.href
      }));
    });
    
    // 解析和提取问题
    for (const item of items) {
      const extractedQuestions = this.extractQuestions(item.content || '');
      questions.push(...extractedQuestions.map(q => ({
        id: this.generateId(),
        question: q,
        category: options.category,
        source: '牛客网',
        company: item.company,
        tags: item.tags || [],
        url: item.url
      })));
    }
    
    return questions;
  }
  
  private extractQuestions(content: string): string[] {
    const questions: string[] = [];
    
    // 改进的问题提取规则
    const patterns = [
      /\d+[.、]\s*([^。？\n]{10,200}[？?])/g,
      /问[:：]\s*([^。？\n]{10,200}[？?])/g,
      /(?:请|试|简述|说明|解释|分析)([^。？\n]{10,200})/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const question = this.cleanQuestion(match[1]);
        if (this.isValidQuestion(question)) {
          questions.push(question);
        }
      }
    }
    
    return questions;
  }
}
```

## 三、具体实施方案

### 3.1 第一阶段：快速MVP（3-5天）

#### Step 1: 后端API搭建
```bash
# 初始化后端项目
cd interview-system
mkdir server
cd server
npm init -y
npm install express cors playwright redis bull dotenv
npm install -D @types/node @types/express typescript nodemon
```

#### Step 2: 实现基础爬虫
```typescript
// server/crawlers/basic.ts
export class BasicCrawler {
  async crawl(url: string): Promise<string> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // 反反爬策略
    await page.addInitScript(() => {
      // 隐藏自动化特征
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // 模拟真实用户
      window.chrome = { runtime: {} };
    });
    
    await page.goto(url);
    const content = await page.content();
    await browser.close();
    
    return content;
  }
}
```

#### Step 3: 集成到前端
```typescript
// src/services/api/crawler.ts
export class CrawlerAPI {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  async crawlQuestions(params: CrawlParams) {
    const response = await fetch(`${this.baseURL}/api/crawl/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    return response.json();
  }
  
  async getCrawlJob(jobId: string) {
    const response = await fetch(`${this.baseURL}/api/crawl/job/${jobId}`);
    return response.json();
  }
}
```

### 3.2 第二阶段：优化提升（1-2周）

#### 1. 添加智能缓存
```typescript
// server/services/cache.ts
import Redis from 'ioredis';
import crypto from 'crypto';

export class SmartCache {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: 6379
    });
  }
  
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    // 1. 尝试获取缓存
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 2. 防止缓存击穿（分布式锁）
    const lockKey = `lock:${key}`;
    const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', 10);
    
    if (!locked) {
      // 等待其他进程完成
      await new Promise(r => setTimeout(r, 100));
      return this.getOrFetch(key, fetcher, ttl);
    }
    
    try {
      // 3. 执行爬取
      const result = await fetcher();
      
      // 4. 存储结果
      await this.redis.setex(key, ttl, JSON.stringify(result));
      
      return result;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
```

#### 2. 实现代理池
```typescript
// server/services/proxy.ts
export class ProxyPool {
  private proxies: Proxy[] = [];
  private currentIndex = 0;
  
  async initialize() {
    // 从多个来源获取代理
    this.proxies = [
      ...await this.fetchFreeProxies(),
      ...await this.fetchPaidProxies()
    ];
  }
  
  getNext(): Proxy {
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
  
  async testProxy(proxy: Proxy): Promise<boolean> {
    try {
      const response = await fetch('http://httpbin.org/ip', {
        agent: new HttpsProxyAgent(proxy.url)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

#### 3. 任务队列管理
```typescript
// server/services/queue.ts
import Bull from 'bull';

export class QueueManager {
  private crawlQueue: Bull.Queue;
  
  constructor() {
    this.crawlQueue = new Bull('crawl-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379
      }
    });
    
    this.setupWorkers();
  }
  
  private setupWorkers() {
    // 爬虫工作进程
    this.crawlQueue.process('crawl-questions', 3, async (job) => {
      const { category, keywords, maxQuestions } = job.data;
      
      // 更新进度
      await job.progress(10);
      
      // 执行爬取
      const crawler = new CrawlerService();
      const results = await crawler.crawlQuestions({
        category,
        keywords,
        maxQuestions,
        onProgress: (p) => job.progress(p)
      });
      
      await job.progress(100);
      return results;
    });
    
    // 错误处理
    this.crawlQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
      // 可以实现重试逻辑
    });
  }
  
  async addCrawlJob(data: any) {
    return this.crawlQueue.add('crawl-questions', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: false,
      removeOnFail: false
    });
  }
}
```

### 3.3 第三阶段：生产部署（1周）

#### 1. Docker化部署
```dockerfile
# Dockerfile.crawler
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY . .

# 编译TypeScript
RUN npm run build

# 启动服务
CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: 
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:3001
    depends_on:
      - backend

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile.backend
    ports:
      - "3001:3001"
    environment:
      - REDIS_HOST=redis
      - DATABASE_URL=postgresql://user:pass@postgres:5432/interview
    depends_on:
      - redis
      - postgres

  crawler:
    build:
      context: ./server
      dockerfile: Dockerfile.crawler
    environment:
      - REDIS_HOST=redis
      - SCRAPER_API_KEY=${SCRAPER_API_KEY}
    depends_on:
      - redis
    deploy:
      replicas: 3

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=interview
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

#### 2. 监控和日志
```typescript
// server/services/monitoring.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export class MonitoringService {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      transports: [
        new winston.transports.Console(),
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: { node: process.env.ELASTIC_URL },
          index: 'crawler-logs'
        })
      ]
    });
  }
  
  logCrawlMetrics(metrics: CrawlMetrics) {
    this.logger.info('crawl_completed', {
      site: metrics.site,
      duration: metrics.duration,
      questionsFound: metrics.questionsFound,
      success: metrics.success,
      timestamp: new Date()
    });
  }
}
```

## 四、成本效益分析

### 4.1 成本对比

| 方案 | 开发成本 | 月度运营成本 | 稳定性 | 维护难度 |
|-----|---------|------------|--------|---------|
| 纯Playwright | 1周 | ¥200（服务器） | 中 | 高 |
| Playwright + ScraperAPI | 1周 | ¥200 + $49 | 高 | 中 |
| 纯ScraperAPI | 3天 | $149 | 高 | 低 |
| 混合方案（推荐） | 2周 | ¥200 + $49 | 极高 | 中 |

### 4.2 ROI分析
- **开发投入**：2人周 ≈ ¥20,000
- **月度成本**：¥250-400
- **价值产出**：
  - 每月节省人工整理题库时间：40小时
  - 提升面试效率：30%
  - 题库质量提升：显著

## 五、实施计划

### Week 1
- [ ] 搭建后端服务框架
- [ ] 实现Playwright基础爬虫
- [ ] 完成牛客网爬取模块
- [ ] 实现Redis缓存

### Week 2  
- [ ] 添加CSDN、掘金爬取
- [ ] 实现任务队列
- [ ] 集成ScraperAPI备用方案
- [ ] 前端API对接

### Week 3
- [ ] Docker化部署
- [ ] 添加监控告警
- [ ] 性能优化
- [ ] 生产环境部署

## 六、特殊优化建议

### 6.1 针对目标网站的策略

#### 牛客网
```javascript
// 特殊处理：模拟登录获取更多内容
async function crawlNowcoderWithLogin(page) {
  // 使用Cookie池
  await page.context().addCookies(cookiePool.getNext());
  
  // 访问面试专区
  await page.goto('https://www.nowcoder.com/interview/center');
  
  // 使用API接口（如果发现）
  const apiData = await page.evaluate(() => {
    return fetch('/api/interview/questions')
      .then(r => r.json());
  });
}
```

#### CSDN
```javascript
// 利用CSDN的开放性
async function crawlCSDNEfficiently() {
  // 1. 使用站内搜索API
  const searchAPI = 'https://so.csdn.net/api/v3/search';
  
  // 2. 利用RSS订阅
  const rssFeed = 'https://blog.csdn.net/rss/list';
  
  // 3. 爬取热门标签页
  const tagPages = [
    '/tags/MtTaEg0sMDY0ODgtYmxvZwO0O0OO0O0O.html', // 面试
    '/tags/MtjaIg0sNzQzOTgtYmxvZwO0O0OO0O0O.html'  // 算法
  ];
}
```

### 6.2 数据质量保证

```typescript
// 智能问题提取和验证
class QuestionExtractor {
  private nlpService: NLPService;
  
  async extractAndValidate(content: string): Promise<Question[]> {
    // 1. 使用NLP提取问句
    const sentences = await this.nlpService.extractQuestions(content);
    
    // 2. 过滤低质量内容
    const filtered = sentences.filter(s => {
      return s.length > 10 && 
             s.length < 200 &&
             this.hasQuestionPattern(s) &&
             !this.isSpam(s);
    });
    
    // 3. 分类和打标签
    return filtered.map(s => ({
      text: s,
      category: this.categorize(s),
      difficulty: this.assessDifficulty(s),
      quality: this.scoreQuality(s)
    }));
  }
}
```

## 七、备用方案

如果技术实施遇到困难，可考虑：

1. **购买现成数据**：联系数据提供商
2. **合作获取**：与牛客网等平台合作
3. **众包收集**：让用户贡献面试题
4. **AI生成**：使用GPT生成模拟题

## 八、总结

推荐采用**渐进式实施策略**：
1. 先用ScraperAPI快速验证
2. 逐步迁移到Playwright降低成本
3. 建立完善的缓存和队列机制
4. 持续优化爬取质量和效率

这样既能快速上线，又能控制成本，同时保证系统的可扩展性和稳定性。