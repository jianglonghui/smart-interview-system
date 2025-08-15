import { JobPosition, CrawlOptions, BatchCrawlResult, HealthStatus } from '../types/crawler';
export declare class CrawlerService {
    private browser;
    private context;
    private isInitialized;
    constructor();
    private initializeBrowser;
    private ensureBrowserReady;
    crawlJob(url: string, platform?: string, options?: CrawlOptions): Promise<JobPosition>;
    crawlJobsBatch(urls: string[], platform?: string, options?: CrawlOptions): Promise<BatchCrawlResult[]>;
    private extractJobData;
    private extractZhipinJob;
    private extractLiepinJob;
    private extractLagouJob;
    private extract51jobJob;
    private extractGenericJob;
    private extractWithSelectors;
    healthCheck(): Promise<HealthStatus>;
    private checkBrowserHealth;
    destroy(): Promise<void>;
}
export default CrawlerService;
//# sourceMappingURL=CrawlerService.d.ts.map