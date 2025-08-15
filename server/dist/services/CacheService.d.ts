export declare class CacheService {
    private readonly keyPrefix;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    expire(key: string, seconds: number): Promise<boolean>;
    getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
    deletePattern(pattern: string): Promise<number>;
    cached<T>(fn: Function, args: any[], options?: {
        ttl?: number;
        keyPrefix?: string;
        keyGenerator?: (fn: Function, args: any[]) => string;
    }): Promise<T>;
    increment(key: string, value?: number, ttl?: number): Promise<number>;
    hSet(key: string, field: string, value: string): Promise<void>;
    hGet(key: string, field: string): Promise<string | null>;
    hGetAll(key: string): Promise<Record<string, string>>;
    clear(): Promise<number>;
    getStats(): Promise<{
        totalKeys: number;
        memoryUsed: string;
        hitRate?: number;
    }>;
    private defaultKeyGenerator;
    private hashArgs;
}
export default CacheService;
//# sourceMappingURL=CacheService.d.ts.map