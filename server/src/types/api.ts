// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    redis: 'connected' | 'disconnected' | 'error';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
  environment?: string;
}

export interface DetailedHealthResponse extends HealthCheckResponse {
  system: {
    platform: string;
    nodeVersion: string;
    pid: number;
    environment: string;
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
  };
  dependencies: {
    redis: string;
    [key: string]: string;
  };
  performance: {
    responseTime: number;
    memoryLeaks: {
      potential_leak: boolean;
      heap_used_mb: number;
      heap_total_mb: number;
      external_mb: number;
    };
  };
  checks: Array<{
    name: string;
    status: string;
    critical: boolean;
  }>;
}

// PDF API types
export interface PdfParseRequest {
  options?: {
    maxPages?: number;
    normalizeWhitespace?: boolean;
  };
}

export interface PdfParseResponse extends ApiResponse {
  data?: {
    text: string;
    pages: number;
    info: any;
    metadata: {
      filename: string;
      size: number;
      processingTime: number;
      title?: string;
      author?: string;
      subject?: string;
      creator?: string;
      producer?: string;
      creationDate?: Date;
      modificationDate?: Date;
    };
  };
}

export interface PdfValidationResponse extends ApiResponse {
  data?: {
    filename: string;
    size: number;
    mimetype: string;
    valid: boolean;
  };
}

export interface PdfInfoResponse extends ApiResponse {
  data?: {
    maxFileSize: number;
    maxFileSizeMB: number;
    supportedFormats: string[];
    features: string[];
    limitations: string[];
  };
}

// Crawler API types
export interface CrawlerJobRequest {
  url: string;
  platform?: 'zhipin' | 'liepin' | 'lagou' | '51job' | 'generic';
  options?: {
    maxPages?: number;
    delay?: number;
    includeDescription?: boolean;
    includeRequirements?: boolean;
    timeout?: number;
    retries?: number;
    screenshots?: boolean;
    waitForSelector?: string;
    customSelectors?: Record<string, string>;
  };
}

export interface CrawlerJobResponse extends ApiResponse {
  data?: {
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
  };
  cached?: boolean;
  processingTime?: number;
}

export interface CrawlerBatchRequest {
  urls: string[];
  platform?: 'zhipin' | 'liepin' | 'lagou' | '51job' | 'generic';
  options?: {
    maxPages?: number;
    delay?: number;
    includeDescription?: boolean;
    includeRequirements?: boolean;
    timeout?: number;
    retries?: number;
  };
}

export interface CrawlerBatchResponse extends ApiResponse {
  data?: {
    results: Array<{
      url: string;
      success: boolean;
      data?: CrawlerJobResponse['data'];
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  };
  processingTime?: number;
}

export interface CrawlerStatusResponse extends ApiResponse {
  data?: {
    jobId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: {
      current: number;
      total: number;
      percentage: number;
    };
    startTime: Date;
    endTime?: Date;
    results?: CrawlerJobResponse['data'][];
    errors?: string[];
  };
}

export interface CrawlerPlatformsResponse extends ApiResponse {
  data?: {
    platforms: Array<{
      id: string;
      name: string;
      domain: string;
      features: string[];
      limitations: string[];
    }>;
    recommendations: string[];
  };
}

export interface CrawlerHealthResponse extends ApiResponse {
  data?: {
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
  };
}

// Request context types
export interface RequestContext {
  ip: string;
  userAgent: string;
  timestamp: Date;
  requestId: string;
  userId?: string;
  sessionId?: string;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// File upload types
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

// Cache types
export interface CacheInfo {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface CacheStats {
  totalKeys: number;
  memoryUsed: string;
  hitRate?: number;
  missRate?: number;
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    hits: number;
    misses: number;
  };
}

// Error response types
export interface ErrorResponse extends ApiResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
  stack?: string;
  timestamp: string;
  requestId?: string;
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ValidationErrorResponse extends ErrorResponse {
  details: ValidationError[];
}

// Async job types (for future use)
export interface AsyncJobRequest {
  type: string;
  payload: any;
  options?: {
    delay?: number;
    retries?: number;
    timeout?: number;
  };
}

export interface AsyncJobResponse extends ApiResponse {
  data?: {
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    queuePosition?: number;
    estimatedTime?: number;
  };
}

// Metrics types
export interface ServiceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  errors: {
    count: number;
    rate: number;
    lastError?: {
      message: string;
      timestamp: Date;
    };
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalOperations: number;
  };
}

export default {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  HealthCheckResponse,
  DetailedHealthResponse,
  PdfParseRequest,
  PdfParseResponse,
  CrawlerJobRequest,
  CrawlerJobResponse,
  CrawlerBatchRequest,
  CrawlerBatchResponse,
  ErrorResponse,
  ValidationErrorResponse,
};