import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../config/logger';
import { config } from '../config/config';
import { 
  JobPosition, 
  CrawlOptions, 
  CrawlResult, 
  BatchCrawlResult,
  CrawlStatus,
  HealthStatus 
} from '../types/crawler';

export class CrawlerService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeBrowser();
  }

  /**
   * Initialize the browser instance
   */
  private async initializeBrowser(): Promise<void> {
    try {
      if (this.browser) {
        return;
      }

      logger.info('Initializing Playwright browser...');
      
      this.browser = await chromium.launch({
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
        userAgent: config.crawlerUserAgent,
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
      });

      this.isInitialized = true;
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Ensure browser is initialized
   */
  private async ensureBrowserReady(): Promise<void> {
    if (!this.isInitialized || !this.browser || !this.context) {
      await this.initializeBrowser();
    }
  }

  /**
   * Crawl a single job position
   */
  public async crawlJob(
    url: string, 
    platform: string = 'generic', 
    options: CrawlOptions = {}
  ): Promise<JobPosition> {
    await this.ensureBrowserReady();
    
    const page = await this.context!.newPage();
    
    try {
      logger.info('Starting job crawl', { url, platform });

      // Set timeout and other options
      page.setDefaultTimeout(options.timeout || config.crawlerTimeout);
      
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: options.timeout || config.crawlerTimeout,
      });

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      
      // Add delay to avoid being detected as bot
      if (options.delay) {
        await page.waitForTimeout(options.delay);
      }

      // Extract job information based on platform
      const jobData = await this.extractJobData(page, platform, options);
      
      logger.info('Job crawl completed', { 
        url, 
        title: jobData.title,
        company: jobData.company 
      });

      return jobData;
    } catch (error) {
      logger.error('Job crawl failed', { url, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Crawl multiple jobs in batch
   */
  public async crawlJobsBatch(
    urls: string[], 
    platform: string = 'generic', 
    options: CrawlOptions = {}
  ): Promise<BatchCrawlResult[]> {
    const results: BatchCrawlResult[] = [];
    
    for (const url of urls) {
      try {
        const jobData = await this.crawlJob(url, platform, options);
        results.push({
          url,
          success: true,
          data: jobData,
        });
        
        // Add delay between requests to be respectful
        if (options.delay && urls.indexOf(url) < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
      } catch (error) {
        logger.error('Failed to crawl job in batch', { url, error });
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Extract job data from page based on platform
   */
  private async extractJobData(
    page: Page, 
    platform: string, 
    options: CrawlOptions
  ): Promise<JobPosition> {
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

  /**
   * Extract job data from BOSS直聘
   */
  private async extractZhipinJob(page: Page, options: CrawlOptions): Promise<JobPosition> {
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

  /**
   * Extract job data from 猎聘网
   */
  private async extractLiepinJob(page: Page, options: CrawlOptions): Promise<JobPosition> {
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

  /**
   * Extract job data from 拉勾网
   */
  private async extractLagouJob(page: Page, options: CrawlOptions): Promise<JobPosition> {
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

  /**
   * Extract job data from 前程无忧
   */
  private async extract51jobJob(page: Page, options: CrawlOptions): Promise<JobPosition> {
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

  /**
   * Extract job data using generic selectors
   */
  private async extractGenericJob(page: Page, options: CrawlOptions): Promise<JobPosition> {
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

  /**
   * Extract job data using provided selectors
   */
  private async extractWithSelectors(
    page: Page, 
    selectors: Record<string, string>, 
    options: CrawlOptions
  ): Promise<JobPosition> {
    const jobData: Partial<JobPosition> = {
      url: page.url(),
      crawledAt: new Date(),
    };

    // Extract each field
    for (const [field, selector] of Object.entries(selectors)) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          if (text && text.trim()) {
            (jobData as any)[field] = text.trim();
          }
        }
      } catch (error) {
        logger.debug(`Failed to extract ${field}`, { selector, error });
      }
    }

    // Extract meta information
    try {
      const title = await page.title();
      if (title && !jobData.title) {
        jobData.title = title;
      }
    } catch (error) {
      logger.debug('Failed to get page title', error);
    }

    // Set default values
    return {
      title: jobData.title || '未知职位',
      company: jobData.company || '未知公司',
      salary: jobData.salary || '薪资面议',
      location: jobData.location || '不限地区',
      experience: jobData.experience || '经验不限',
      education: jobData.education || '学历不限',
      description: options.includeDescription !== false ? (jobData.description || '') : '',
      requirements: options.includeRequirements !== false ? (jobData.requirements || '') : '',
      url: jobData.url!,
      crawledAt: jobData.crawledAt!,
    };
  }

  /**
   * Health check for crawler service
   */
  public async healthCheck(): Promise<HealthStatus> {
    try {
      const isReady = await this.checkBrowserHealth();
      
      return {
        status: isReady ? 'healthy' : 'unhealthy',
        browser: isReady ? 'running' : 'stopped',
        lastCheck: new Date(),
        uptime: process.uptime(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        browser: 'error',
        lastCheck: new Date(),
        uptime: process.uptime(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if browser is healthy
   */
  private async checkBrowserHealth(): Promise<boolean> {
    try {
      await this.ensureBrowserReady();
      
      if (!this.browser || !this.context) {
        return false;
      }

      // Test with a simple page
      const page = await this.context.newPage();
      await page.goto('about:blank');
      await page.close();
      
      return true;
    } catch (error) {
      logger.error('Browser health check failed:', error);
      return false;
    }
  }

  /**
   * Close browser and cleanup resources
   */
  public async destroy(): Promise<void> {
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
      logger.info('Crawler service destroyed successfully');
    } catch (error) {
      logger.error('Error destroying crawler service:', error);
    }
  }
}

export default CrawlerService;