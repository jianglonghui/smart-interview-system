export interface JobPosition {
    title: string;
    company: string;
    salary: string;
    location: string;
    experience: string;
    education: string;
    description: string;
    requirements: string;
    url: string;
    crawledAt: Date;
    tags?: string[];
    benefits?: string[];
    companySize?: string;
    industry?: string;
    jobType?: 'full-time' | 'part-time' | 'contract' | 'internship';
}
export interface CrawlOptions {
    maxPages?: number;
    delay?: number;
    includeDescription?: boolean;
    includeRequirements?: boolean;
    timeout?: number;
    retries?: number;
    userAgent?: string;
    viewport?: {
        width: number;
        height: number;
    };
    screenshots?: boolean;
    waitForSelector?: string;
    customSelectors?: Record<string, string>;
}
export interface CrawlJobRequest {
    url: string;
    platform?: 'zhipin' | 'liepin' | 'lagou' | '51job' | 'generic';
    options?: CrawlOptions;
}
export interface CrawlJobResponse {
    success: boolean;
    data?: JobPosition;
    error?: string;
    cached?: boolean;
    processingTime?: number;
}
export interface BatchCrawlRequest {
    urls: string[];
    platform?: 'zhipin' | 'liepin' | 'lagou' | '51job' | 'generic';
    options?: CrawlOptions;
}
export interface BatchCrawlResult {
    url: string;
    success: boolean;
    data?: JobPosition;
    error?: string;
}
export interface CrawlResult<T = JobPosition> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        processingTime: number;
        retries: number;
        cached: boolean;
    };
}
export interface CrawlStatus {
    jobId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
    startTime: Date;
    endTime?: Date;
    results?: JobPosition[];
    errors?: string[];
    metadata?: {
        platform: string;
        urls: string[];
        options: CrawlOptions;
    };
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    browser: 'running' | 'stopped' | 'error';
    lastCheck: Date;
    uptime: number;
    error?: string;
    metrics?: {
        totalCrawls: number;
        successRate: number;
        avgResponseTime: number;
    };
}
export interface CrawlerStats {
    totalJobs: number;
    successfulCrawls: number;
    failedCrawls: number;
    avgResponseTime: number;
    cacheHitRate: number;
    browserRestarts: number;
    lastActivity: Date;
    platformStats: Record<string, {
        count: number;
        successRate: number;
        avgTime: number;
    }>;
}
export interface PlatformConfig {
    id: string;
    name: string;
    domain: string;
    selectors: {
        title: string[];
        company: string[];
        salary: string[];
        location: string[];
        experience: string[];
        education: string[];
        description: string[];
        requirements: string[];
    };
    features: string[];
    limitations: string[];
    rateLimit: {
        requests: number;
        windowMs: number;
    };
    antiBot: {
        delay: number;
        userAgent: string;
        headers?: Record<string, string>;
    };
}
export declare class CrawlerError extends Error {
    code: string;
    url?: string | undefined;
    platform?: string | undefined;
    constructor(message: string, code: string, url?: string | undefined, platform?: string | undefined);
}
export declare class TimeoutError extends CrawlerError {
    constructor(url: string, timeout: number);
}
export declare class NetworkError extends CrawlerError {
    constructor(url: string, message: string);
}
export declare class ParseError extends CrawlerError {
    constructor(url: string, field: string, message: string);
}
export declare class RateLimitError extends CrawlerError {
    constructor(platform: string, retryAfter?: number);
}
export interface ZhipinJobPosition extends JobPosition {
    bossName?: string;
    bossTitle?: string;
    bossAvatar?: string;
    companyLogo?: string;
    welfare?: string[];
    skills?: string[];
}
export interface LiepinJobPosition extends JobPosition {
    publishTime?: Date;
    applyCount?: number;
    viewCount?: number;
    companyNature?: string;
    companyScale?: string;
}
export interface LagouJobPosition extends JobPosition {
    workType?: string;
    processInfo?: string[];
    createTime?: Date;
    industryField?: string;
    financeStage?: string;
}
export interface FiftyOneJobPosition extends JobPosition {
    jobNature?: string;
    reportTo?: string;
    departmentName?: string;
    positionAttribute?: string;
    currentStatus?: string;
}
//# sourceMappingURL=crawler.d.ts.map