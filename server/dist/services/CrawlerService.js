"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerService = void 0;
const playwright_1 = require("playwright");
const logger_1 = require("../config/logger");
const config_1 = require("../config/config");
class CrawlerService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.isInitialized = false;
        this.initializeBrowser();
    }
    async initializeBrowser() {
        try {
            if (this.browser) {
                return;
            }
            logger_1.logger.info('Initializing Playwright browser...');
            this.browser = await playwright_1.chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                ],
            });
            this.context = await this.browser.newContext({
                userAgent: config_1.config.crawlerUserAgent,
                viewport: { width: 1920, height: 1080 },
                ignoreHTTPSErrors: true,
            });
            this.isInitialized = true;
            logger_1.logger.info('Browser initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize browser:', error);
            throw error;
        }
    }
    async ensureBrowserReady() {
        if (!this.isInitialized || !this.browser || !this.context) {
            await this.initializeBrowser();
        }
    }
    async crawlJob(url, platform = 'generic', options = {}) {
        await this.ensureBrowserReady();
        const page = await this.context.newPage();
        try {
            logger_1.logger.info('Starting job crawl', { url, platform });
            page.setDefaultTimeout(options.timeout || config_1.config.crawlerTimeout);
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: options.timeout || config_1.config.crawlerTimeout,
            });
            await page.waitForLoadState('domcontentloaded');
            if (options.delay) {
                await page.waitForTimeout(options.delay);
            }
            const jobData = await this.extractJobData(page, platform, options);
            logger_1.logger.info('Job crawl completed', {
                url,
                title: jobData.title,
                company: jobData.company
            });
            return jobData;
        }
        catch (error) {
            logger_1.logger.error('Job crawl failed', { url, error });
            throw error;
        }
        finally {
            await page.close();
        }
    }
    async crawlJobsBatch(urls, platform = 'generic', options = {}) {
        const results = [];
        for (const url of urls) {
            try {
                const jobData = await this.crawlJob(url, platform, options);
                results.push({
                    url,
                    success: true,
                    data: jobData,
                });
                if (options.delay && urls.indexOf(url) < urls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, options.delay));
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to crawl job in batch', { url, error });
                results.push({
                    url,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return results;
    }
    async extractJobData(page, platform, options) {
        switch (platform) {
            case 'zhipin':
                return this.extractZhipinJob(page, options);
            case 'liepin':
                return this.extractLiepinJob(page, options);
            case 'lagou':
                return this.extractLagouJob(page, options);
            case '51job':
                return this.extract51jobJob(page, options);
            default:
                return this.extractGenericJob(page, options);
        }
    }
    async extractZhipinJob(page, options) {
        const selectors = {
            title: '.job-title, .name, h1',
            company: '.company-name, .company, [class*="company"]',
            salary: '.salary, .money, [class*="salary"]',
            location: '.job-area, .location, [class*="location"]',
            experience: '.job-experience, .experience, [class*="experience"]',
            education: '.job-degree, .education, [class*="education"]',
            description: '.job-detail, .job-description, .detail-content',
            requirements: '.job-require, .requirements',
        };
        return this.extractWithSelectors(page, selectors, options);
    }
    async extractLiepinJob(page, options) {
        const selectors = {
            title: '.position-title, .job-title, h1',
            company: '.company-name, .company',
            salary: '.salary-text, .salary',
            location: '.work-addr, .location',
            experience: '.work-experience, .experience',
            education: '.education-text, .education',
            description: '.job-description, .job-detail',
            requirements: '.job-require, .requirements',
        };
        return this.extractWithSelectors(page, selectors, options);
    }
    async extractLagouJob(page, options) {
        const selectors = {
            title: '.position-name, .job-name',
            company: '.company-name, .company',
            salary: '.salary-text, .salary',
            location: '.work-address, .location',
            experience: '.work-year, .experience',
            education: '.education, .xueli',
            description: '.job-detail, .job_bt',
            requirements: '.job-require, .requirements',
        };
        return this.extractWithSelectors(page, selectors, options);
    }
    async extract51jobJob(page, options) {
        const selectors = {
            title: '.job-title, .in-dl-title',
            company: '.company-name, .in-dl-company',
            salary: '.salary, .in-dl-salary',
            location: '.location, .in-dl-location',
            experience: '.experience, .in-dl-experience',
            education: '.education, .in-dl-education',
            description: '.job-description, .bmsg',
            requirements: '.job-require, .requirements',
        };
        return this.extractWithSelectors(page, selectors, options);
    }
    async extractGenericJob(page, options) {
        const selectors = {
            title: 'h1, .title, .job-title, [class*="title"], [id*="title"]',
            company: '.company, .company-name, [class*="company"], [id*="company"]',
            salary: '.salary, .price, .money, [class*="salary"], [class*="price"]',
            location: '.location, .address, .city, [class*="location"], [class*="address"]',
            experience: '.experience, .exp, [class*="experience"], [class*="exp"]',
            education: '.education, .degree, [class*="education"], [class*="degree"]',
            description: '.description, .detail, .content, .job-desc, [class*="description"]',
            requirements: '.requirements, .require, [class*="require"]',
        };
        return this.extractWithSelectors(page, selectors, options);
    }
    async extractWithSelectors(page, selectors, options) {
        const jobData = {
            url: page.url(),
            crawledAt: new Date(),
        };
        for (const [field, selector] of Object.entries(selectors)) {
            try {
                const element = await page.locator(selector).first();
                if (await element.count() > 0) {
                    const text = await element.textContent();
                    if (text && text.trim()) {
                        jobData[field] = text.trim();
                    }
                }
            }
            catch (error) {
                logger_1.logger.debug(`Failed to extract ${field}`, { selector, error });
            }
        }
        try {
            const title = await page.title();
            if (title && !jobData.title) {
                jobData.title = title;
            }
        }
        catch (error) {
            logger_1.logger.debug('Failed to get page title', error);
        }
        return {
            title: jobData.title || '未知职位',
            company: jobData.company || '未知公司',
            salary: jobData.salary || '薪资面议',
            location: jobData.location || '不限地区',
            experience: jobData.experience || '经验不限',
            education: jobData.education || '学历不限',
            description: options.includeDescription !== false ? (jobData.description || '') : '',
            requirements: options.includeRequirements !== false ? (jobData.requirements || '') : '',
            url: jobData.url,
            crawledAt: jobData.crawledAt,
        };
    }
    async healthCheck() {
        try {
            const isReady = await this.checkBrowserHealth();
            return {
                status: isReady ? 'healthy' : 'unhealthy',
                browser: isReady ? 'running' : 'stopped',
                lastCheck: new Date(),
                uptime: process.uptime(),
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                browser: 'error',
                lastCheck: new Date(),
                uptime: process.uptime(),
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async checkBrowserHealth() {
        try {
            await this.ensureBrowserReady();
            if (!this.browser || !this.context) {
                return false;
            }
            const page = await this.context.newPage();
            await page.goto('about:blank');
            await page.close();
            return true;
        }
        catch (error) {
            logger_1.logger.error('Browser health check failed:', error);
            return false;
        }
    }
    async destroy() {
        try {
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.isInitialized = false;
            logger_1.logger.info('Crawler service destroyed successfully');
        }
        catch (error) {
            logger_1.logger.error('Error destroying crawler service:', error);
        }
    }
}
exports.CrawlerService = CrawlerService;
exports.default = CrawlerService;
//# sourceMappingURL=CrawlerService.js.map