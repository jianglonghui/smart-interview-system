interface CrawlOptions {
    category: string;
    keywords?: string[];
    maxQuestions?: number;
    sites?: string[];
}
interface CrawledQuestion {
    id: string;
    question: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    type: string;
    source: string;
    company?: string;
    tags: string[];
    url?: string;
    crawledAt: Date;
}
interface CrawlResult {
    success: boolean;
    questions: CrawledQuestion[];
    source: string;
    timestamp: number;
    error?: string;
    cached?: boolean;
}
export declare class InterviewCrawlerService {
    private browser;
    private cacheService;
    private isInitialized;
    private readonly siteConfigs;
    private readonly categoryKeywords;
    constructor();
    initialize(): Promise<void>;
    crawlQuestions(options: CrawlOptions): Promise<CrawlResult>;
    private crawlSite;
    private crawlSiteWithKeyword;
    private crawlNowcoder;
    private crawlCSDN;
    private crawlJuejin;
    private setupAntiDetection;
    private extractQuestions;
    private cleanQuestion;
    private isInterviewRelated;
    private inferDifficulty;
    private inferQuestionType;
    private extractCompany;
    private extractTags;
    private processQuestions;
    private generateCacheKey;
    private generateQuestionId;
    private delay;
    cleanup(): Promise<void>;
}
export declare const interviewCrawler: InterviewCrawlerService;
export {};
//# sourceMappingURL=InterviewCrawlerService.d.ts.map