interface Config {
    port: number;
    nodeEnv: string;
    corsOrigin: string;
    redisUrl: string;
    redisPassword?: string;
    redisDb: number;
    glmApiKey?: string;
    openaiApiKey?: string;
    crawlerTimeout: number;
    crawlerMaxRetries: number;
    crawlerDelay: number;
    crawlerUserAgent: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    maxFileSize: number;
    uploadDir: string;
    jwtSecret?: string;
    logLevel: string;
    logDir: string;
}
export declare const config: Config;
export declare function validateConfig(): void;
export default config;
//# sourceMappingURL=config.d.ts.map