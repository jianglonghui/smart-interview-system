import { RedisClientType } from 'redis';
declare class RedisService {
    private client;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): RedisClientType;
    isReady(): boolean;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<boolean>;
    setJSON(key: string, value: any, ttl?: number): Promise<void>;
    getJSON<T>(key: string): Promise<T | null>;
    hSet(key: string, field: string, value: string): Promise<number>;
    hGet(key: string, field: string): Promise<string | undefined>;
    hGetAll(key: string): Promise<Record<string, string>>;
}
export declare const redisService: RedisService;
export default redisService;
//# sourceMappingURL=redis.d.ts.map