"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewCrawler = exports.InterviewCrawlerService = void 0;
const playwright_1 = require("playwright");
const CacheService_1 = require("./CacheService");
const logger_1 = require("../config/logger");
const crypto_1 = __importDefault(require("crypto"));
class InterviewCrawlerService {
    constructor() {
        this.browser = null;
        this.isInitialized = false;
        this.siteConfigs = {
            nowcoder: {
                name: '牛客网',
                baseUrl: 'https://www.nowcoder.com',
                searchUrl: 'https://www.nowcoder.com/discuss/tag/639',
                selectors: {
                    container: '.discuss-list',
                    items: '.discuss-item',
                    title: '.discuss-title',
                    content: '.discuss-brief',
                    tags: '.tag',
                    company: '.company-tag'
                }
            },
            csdn: {
                name: 'CSDN',
                baseUrl: 'https://blog.csdn.net',
                searchUrl: 'https://so.csdn.net/so/search',
                selectors: {
                    container: '.search-list',
                    items: '.search-list-item',
                    title: '.search-title',
                    content: '.search-des',
                    tags: '.tag'
                }
            },
            juejin: {
                name: '掘金',
                baseUrl: 'https://juejin.cn',
                searchUrl: 'https://juejin.cn/search',
                selectors: {
                    container: '.search-result-list',
                    items: '.search-result-item',
                    title: '.title',
                    content: '.abstract',
                    tags: '.tag'
                }
            }
        };
        this.categoryKeywords = {
            '前端开发': ['前端', 'javascript', 'react', 'vue', 'css', 'webpack'],
            '后端开发': ['后端', 'java', 'spring', 'mysql', 'redis', 'microservice'],
            '算法岗': ['算法', 'leetcode', '数据结构', '动态规划', '机器学习'],
            '测试开发': ['测试', '自动化测试', '性能测试', 'selenium', 'jest'],
            '运维开发': ['运维', 'devops', 'kubernetes', 'docker', 'linux'],
            '产品经理': ['产品经理', '需求分析', '用户体验', 'PRD', '竞品分析'],
            '数据分析': ['数据分析', 'sql', 'python', 'tableau', '数据挖掘']
        };
        this.cacheService = new CacheService_1.CacheService();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            logger_1.logger.info('Initializing Playwright browser...');
            this.browser = await playwright_1.chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
            this.isInitialized = true;
            logger_1.logger.info('Playwright browser initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Playwright:', error);
            throw new Error('Failed to initialize crawler service');
        }
    }
    async crawlQuestions(options) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(options);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.info('Returning cached results for:', cacheKey);
            return { ...cached, cached: true };
        }
        if (!this.isInitialized) {
            await this.initialize();
        }
        const sites = options.sites || ['nowcoder', 'csdn', 'juejin'];
        const maxQuestions = options.maxQuestions || 20;
        const allQuestions = [];
        const errors = [];
        logger_1.logger.info('Starting crawl for category:', options.category);
        for (const site of sites) {
            try {
                const questions = await this.crawlSite(site, options);
                allQuestions.push(...questions);
                logger_1.logger.info(`Crawled ${questions.length} questions from ${site}`);
            }
            catch (error) {
                const errorMsg = `Failed to crawl ${site}: ${error}`;
                logger_1.logger.error(errorMsg);
                errors.push(errorMsg);
            }
        }
        const processedQuestions = this.processQuestions(allQuestions, maxQuestions);
        const result = {
            success: processedQuestions.length > 0,
            questions: processedQuestions,
            source: sites.join(', '),
            timestamp: Date.now(),
            error: errors.length > 0 ? errors.join('; ') : undefined
        };
        await this.cacheService.set(cacheKey, result, 86400);
        logger_1.logger.info(`Crawl completed in ${Date.now() - startTime}ms, found ${processedQuestions.length} questions`);
        return result;
    }
    async crawlSite(site, options) {
        const config = this.siteConfigs[site];
        if (!config) {
            throw new Error(`Unsupported site: ${site}`);
        }
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'zh-CN'
        });
        const page = await context.newPage();
        const questions = [];
        try {
            await this.setupAntiDetection(page);
            const keywords = options.keywords || this.categoryKeywords[options.category] || [options.category];
            for (const keyword of keywords.slice(0, 2)) {
                try {
                    const siteQuestions = await this.crawlSiteWithKeyword(page, site, keyword, options.category);
                    questions.push(...siteQuestions);
                    await this.delay(1000 + Math.random() * 2000);
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to crawl ${site} with keyword ${keyword}:`, error);
                }
            }
        }
        finally {
            await context.close();
        }
        return questions;
    }
    async crawlSiteWithKeyword(page, site, keyword, category) {
        const questions = [];
        if (site === 'nowcoder') {
            return await this.crawlNowcoder(page, keyword, category);
        }
        else if (site === 'csdn') {
            return await this.crawlCSDN(page, keyword, category);
        }
        else if (site === 'juejin') {
            return await this.crawlJuejin(page, keyword, category);
        }
        return questions;
    }
    async crawlNowcoder(page, keyword, category) {
        const questions = [];
        const config = this.siteConfigs.nowcoder;
        try {
            const url = `${config.searchUrl}?keyword=${encodeURIComponent(keyword + ' 面试')}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector(config.selectors.container, { timeout: 10000 }).catch(() => { });
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await this.delay(1500);
            }
            const items = await page.$$(config.selectors.items);
            for (const item of items.slice(0, 10)) {
                try {
                    const title = await item.$eval(config.selectors.title, el => el.textContent?.trim() || '').catch(() => '');
                    const content = await item.$eval(config.selectors.content, el => el.textContent?.trim() || '').catch(() => '');
                    const url = await item.$eval('a', el => el.href).catch(() => '');
                    if (this.isInterviewRelated(title + ' ' + content)) {
                        const extractedQuestions = this.extractQuestions(title, content);
                        for (const q of extractedQuestions) {
                            questions.push({
                                id: this.generateQuestionId(),
                                question: q,
                                category,
                                difficulty: this.inferDifficulty(q),
                                type: this.inferQuestionType(q),
                                source: '牛客网',
                                company: this.extractCompany(title + ' ' + content),
                                tags: [keyword, ...this.extractTags(content)],
                                url,
                                crawledAt: new Date()
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to extract item:', error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Nowcoder crawl error:', error);
        }
        return questions;
    }
    async crawlCSDN(page, keyword, category) {
        const questions = [];
        const config = this.siteConfigs.csdn;
        try {
            const url = `${config.searchUrl}?q=${encodeURIComponent(keyword + ' 面试题')}&t=blog`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector(config.selectors.container, { timeout: 10000 }).catch(() => { });
            const items = await page.$$(config.selectors.items);
            for (const item of items.slice(0, 8)) {
                try {
                    const title = await item.$eval(config.selectors.title, el => el.textContent?.trim() || '').catch(() => '');
                    const content = await item.$eval(config.selectors.content, el => el.textContent?.trim() || '').catch(() => '');
                    const url = await item.$eval('a', el => el.href).catch(() => '');
                    if (this.isInterviewRelated(title + ' ' + content)) {
                        const extractedQuestions = this.extractQuestions(title, content);
                        for (const q of extractedQuestions) {
                            questions.push({
                                id: this.generateQuestionId(),
                                question: q,
                                category,
                                difficulty: this.inferDifficulty(q),
                                type: this.inferQuestionType(q),
                                source: 'CSDN',
                                company: this.extractCompany(title + ' ' + content),
                                tags: [keyword, ...this.extractTags(content)],
                                url,
                                crawledAt: new Date()
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to extract CSDN item:', error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('CSDN crawl error:', error);
        }
        return questions;
    }
    async crawlJuejin(page, keyword, category) {
        const questions = [];
        const config = this.siteConfigs.juejin;
        try {
            const url = `${config.searchUrl}?query=${encodeURIComponent(keyword + ' 面试')}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector(config.selectors.container, { timeout: 10000 }).catch(() => { });
            const items = await page.$$(config.selectors.items);
            for (const item of items.slice(0, 8)) {
                try {
                    const title = await item.$eval(config.selectors.title, el => el.textContent?.trim() || '').catch(() => '');
                    const content = await item.$eval(config.selectors.content, el => el.textContent?.trim() || '').catch(() => '');
                    const url = await item.$eval('a', el => el.href).catch(() => '');
                    if (this.isInterviewRelated(title + ' ' + content)) {
                        const extractedQuestions = this.extractQuestions(title, content);
                        for (const q of extractedQuestions) {
                            questions.push({
                                id: this.generateQuestionId(),
                                question: q,
                                category,
                                difficulty: this.inferDifficulty(q),
                                type: this.inferQuestionType(q),
                                source: '掘金',
                                company: this.extractCompany(title + ' ' + content),
                                tags: [keyword, ...this.extractTags(content)],
                                url,
                                crawledAt: new Date()
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to extract Juejin item:', error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Juejin crawl error:', error);
        }
        return questions;
    }
    async setupAntiDetection(page) {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        await page.addInitScript(() => {
            window.chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };
        });
        await page.addInitScript(() => {
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters));
        });
    }
    extractQuestions(title, content) {
        const questions = [];
        const text = `${title}\n${content}`;
        const patterns = [
            /\d+[.、]\s*([^。？\n]{10,200}[？?])/g,
            /问题?[:：]\s*([^。？\n]{10,200}[？?])/g,
            /(?:什么是|如何|怎样|为什么|解释)([^。？\n]{10,200})/g,
            /面试官?问[:：]?\s*([^。？\n]{10,200}[？?])/g
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null && questions.length < 5) {
                const q = this.cleanQuestion(match[1]);
                if (q && !questions.includes(q)) {
                    questions.push(q);
                }
            }
        }
        return questions;
    }
    cleanQuestion(question) {
        let cleaned = question.trim()
            .replace(/\s+/g, ' ')
            .replace(/^[^\u4e00-\u9fa5a-zA-Z]+/, '')
            .replace(/[^\u4e00-\u9fa5a-zA-Z\s\?\？]+$/, '');
        if (!cleaned.endsWith('?') && !cleaned.endsWith('？')) {
            if (/^(什么|如何|怎样|为什么|哪些|怎么|是否)/.test(cleaned)) {
                cleaned += '？';
            }
        }
        return cleaned.length > 10 && cleaned.length < 200 ? cleaned : null;
    }
    isInterviewRelated(text) {
        const keywords = ['面试', '面经', '笔试', '题目', '问题', '算法', '技术'];
        const lowerText = text.toLowerCase();
        return keywords.some(k => lowerText.includes(k));
    }
    inferDifficulty(question) {
        const hardPatterns = ['实现', '原理', '底层', '源码', '优化', '架构', '设计'];
        const easyPatterns = ['什么是', '简述', '概念', '定义', '区别'];
        if (hardPatterns.some(p => question.includes(p)))
            return 'hard';
        if (easyPatterns.some(p => question.includes(p)))
            return 'easy';
        return 'medium';
    }
    inferQuestionType(question) {
        if (question.includes('算法') || question.includes('数据结构'))
            return '算法题';
        if (question.includes('项目') || question.includes('经验'))
            return '项目经验';
        if (question.includes('原理') || question.includes('底层'))
            return '原理题';
        if (question.includes('设计') || question.includes('架构'))
            return '系统设计';
        return '技术问题';
    }
    extractCompany(text) {
        const companies = ['阿里', '腾讯', '字节', '百度', '美团', '京东', '网易', '华为', '小米', '滴滴'];
        for (const company of companies) {
            if (text.includes(company))
                return company;
        }
        return undefined;
    }
    extractTags(content) {
        const tags = [];
        const techKeywords = ['javascript', 'react', 'vue', 'java', 'spring', 'mysql', 'redis', 'docker'];
        const lowerContent = content.toLowerCase();
        for (const keyword of techKeywords) {
            if (lowerContent.includes(keyword) && tags.length < 3) {
                tags.push(keyword);
            }
        }
        return tags;
    }
    processQuestions(questions, maxQuestions) {
        const uniqueQuestions = new Map();
        for (const q of questions) {
            const key = q.question.toLowerCase().replace(/\s+/g, '');
            if (!uniqueQuestions.has(key)) {
                uniqueQuestions.set(key, q);
            }
        }
        return Array.from(uniqueQuestions.values())
            .sort((a, b) => {
            if (a.company && !b.company)
                return -1;
            if (!a.company && b.company)
                return 1;
            return b.tags.length - a.tags.length;
        })
            .slice(0, maxQuestions);
    }
    generateCacheKey(options) {
        const data = JSON.stringify({
            category: options.category,
            keywords: options.keywords?.sort(),
            sites: options.sites?.sort()
        });
        return `interview:${crypto_1.default.createHash('md5').update(data).digest('hex')}`;
    }
    generateQuestionId() {
        return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isInitialized = false;
            logger_1.logger.info('Crawler service cleaned up');
        }
    }
}
exports.InterviewCrawlerService = InterviewCrawlerService;
exports.interviewCrawler = new InterviewCrawlerService();
//# sourceMappingURL=InterviewCrawlerService.js.map