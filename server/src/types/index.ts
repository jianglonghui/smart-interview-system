// Main types export file
export * from './crawler';
export * from './validation';
export * from './api';

// Re-export commonly used types
export type {
  JobPosition,
  CrawlOptions,
  CrawlJobRequest,
  CrawlJobResponse,
  BatchCrawlResult,
  CrawlStatus,
  HealthStatus,
} from './crawler';

export type {
  ValidationResult,
  ApiResponse,
  ApiError,
  PaginatedResponse,
  HealthCheckResponse,
  DetailedHealthResponse,
  ErrorResponse,
  ValidationErrorResponse,
} from './api';

// Common utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type NonEmptyArray<T> = [T, ...T[]];

export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeleteFields {
  deletedAt?: Date;
  isDeleted?: boolean;
}

export interface EntityWithId {
  id: string | number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

export interface FilterOptions {
  [key: string]: any;
}

export interface SearchOptions extends PaginationOptions {
  query?: string;
  filters?: FilterOptions;
  sort?: SortOptions;
}

// Environment types
export type NodeEnvironment = 'development' | 'production' | 'test';

// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

// Status types
export type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// HTTP status codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

// Event types for future event-driven architecture
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  version: string;
}

export interface JobCrawledEvent extends BaseEvent {
  type: 'job.crawled';
  data: {
    jobId: string;
    url: string;
    platform: string;
    success: boolean;
    processingTime: number;
  };
}

export interface PdfParsedEvent extends BaseEvent {
  type: 'pdf.parsed';
  data: {
    filename: string;
    size: number;
    pages: number;
    processingTime: number;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: {
    error: string;
    stack?: string;
    context?: any;
  };
}

export type AppEvent = JobCrawledEvent | PdfParsedEvent | ErrorEvent;

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export interface RedisConfig {
  url: string;
  password?: string;
  db: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface CrawlerConfig {
  timeout: number;
  maxRetries: number;
  delay: number;
  userAgent: string;
  maxPages: number;
  screenshotsEnabled: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  corsOrigin: string;
  rateLimitWindow: number;
  rateLimitMax: number;
  uploadMaxSize: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: NodeEnvironment;
  logLevel: LogLevel;
  database?: DatabaseConfig;
  redis: RedisConfig;
  crawler: CrawlerConfig;
  security: SecurityConfig;
}

// Generic utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type PickByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? Key : never }[keyof T]
>;

export type OmitByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? never : Key }[keyof T]
>;

// Function types
export type AsyncFunction<T = any, R = any> = (arg: T) => Promise<R>;
export type EventHandler<T = any> = (event: T) => void | Promise<void>;
export type Middleware<T = any, R = any> = (req: T, res: R, next: Function) => void | Promise<void>;

// Default export for convenience
export default {
  HttpStatus,
};