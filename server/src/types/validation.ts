import Joi from 'joi';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  data?: any;
}

// PDF upload validation
export function validatePdfUpload(file: Express.Multer.File): ValidationResult {
  // Check if file exists
  if (!file) {
    return {
      isValid: false,
      error: '没有上传文件',
    };
  }

  // Check file type
  if (file.mimetype !== 'application/pdf') {
    return {
      isValid: false,
      error: '文件格式不正确，只支持PDF文件',
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `文件大小超过限制（最大${Math.round(maxSize / 1024 / 1024)}MB）`,
    };
  }

  // Check file extension
  const allowedExtensions = ['.pdf'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: '文件扩展名不正确，只支持.pdf文件',
    };
  }

  // Check filename length
  if (file.originalname.length > 255) {
    return {
      isValid: false,
      error: '文件名过长（最大255字符）',
    };
  }

  // Check for suspicious filename patterns
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /[<>:"|?*]/,  // Invalid characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Windows reserved names
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
    return {
      isValid: false,
      error: '文件名包含非法字符',
    };
  }

  return {
    isValid: true,
    data: {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    },
  };
}

// Request validation schemas
export const schemas = {
  // Health check
  healthCheck: Joi.object({
    detailed: Joi.boolean().default(false),
  }),

  // PDF parsing
  pdfParse: Joi.object({
    options: Joi.object({
      maxPages: Joi.number().integer().min(0).max(1000).default(0),
      normalizeWhitespace: Joi.boolean().default(true),
    }).default({}),
  }),

  // Crawler job
  crawlerJob: Joi.object({
    url: Joi.string().uri({
      scheme: ['http', 'https'],
    }).required().messages({
      'string.uri': 'URL格式无效，必须是有效的HTTP或HTTPS地址',
      'any.required': 'URL是必填字段',
    }),
    platform: Joi.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
    options: Joi.object({
      maxPages: Joi.number().integer().min(1).max(10).default(1),
      delay: Joi.number().integer().min(1000).max(10000).default(2000),
      includeDescription: Joi.boolean().default(true),
      includeRequirements: Joi.boolean().default(true),
      timeout: Joi.number().integer().min(5000).max(60000).default(30000),
      retries: Joi.number().integer().min(0).max(5).default(3),
      screenshots: Joi.boolean().default(false),
      waitForSelector: Joi.string().optional(),
      customSelectors: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    }).default({}),
  }),

  // Batch crawler
  crawlerBatch: Joi.object({
    urls: Joi.array().items(
      Joi.string().uri({
        scheme: ['http', 'https'],
      }).required()
    ).min(1).max(5).required().messages({
      'array.min': '至少需要提供1个URL',
      'array.max': '最多支持5个URL的批量爬取',
    }),
    platform: Joi.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
    options: Joi.object({
      maxPages: Joi.number().integer().min(1).max(5).default(1),
      delay: Joi.number().integer().min(1000).max(10000).default(2000),
      includeDescription: Joi.boolean().default(true),
      includeRequirements: Joi.boolean().default(true),
      timeout: Joi.number().integer().min(5000).max(60000).default(30000),
      retries: Joi.number().integer().min(0).max(3).default(2),
    }).default({}),
  }),

  // Cache operations
  cacheDelete: Joi.object({
    pattern: Joi.string().optional(),
    confirm: Joi.boolean().required().valid(true).messages({
      'any.only': '请确认删除操作',
    }),
  }),
};

// Common validation functions
export function validateUrl(url: string): ValidationResult {
  try {
    const parsedUrl = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        isValid: false,
        error: 'URL必须使用HTTP或HTTPS协议',
      };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /localhost/i,
      /127\.0\.0\.1/,
      /192\.168\./,
      /10\./,
      /172\.1[6-9]\./,
      /172\.2[0-9]\./,
      /172\.3[0-1]\./,
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
      return {
        isValid: false,
        error: '不支持本地或内网地址',
      };
    }

    return {
      isValid: true,
      data: {
        url: parsedUrl.href,
        hostname: parsedUrl.hostname,
        protocol: parsedUrl.protocol,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'URL格式无效',
    };
  }
}

export function validateJobPlatform(platform: string): ValidationResult {
  const supportedPlatforms = ['zhipin', 'liepin', 'lagou', '51job', 'generic'];
  
  if (!supportedPlatforms.includes(platform)) {
    return {
      isValid: false,
      error: `不支持的平台：${platform}。支持的平台：${supportedPlatforms.join(', ')}`,
    };
  }

  return {
    isValid: true,
    data: { platform },
  };
}

// Rate limiting validation
export function validateRateLimit(requests: number, windowMs: number): ValidationResult {
  if (requests <= 0 || requests > 1000) {
    return {
      isValid: false,
      error: '请求数量必须在1-1000之间',
    };
  }

  if (windowMs < 1000 || windowMs > 3600000) { // 1s to 1h
    return {
      isValid: false,
      error: '时间窗口必须在1秒到1小时之间',
    };
  }

  return {
    isValid: true,
    data: { requests, windowMs },
  };
}

// Sanitization functions
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.-]/gi, '') // Remove special characters except dots, spaces, hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^[._-]+|[._-]+$/g, '') // Remove leading/trailing dots, underscores, hyphens
    .substring(0, 255); // Limit length
}

export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

// Custom validation middleware
export function createValidationMiddleware(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0]?.message || '请求参数无效',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    // Replace request body with validated data
    req.body = value;
    next();
  };
}

export default {
  validatePdfUpload,
  validateUrl,
  validateJobPlatform,
  validateRateLimit,
  sanitizeFilename,
  sanitizeText,
  createValidationMiddleware,
  schemas,
};