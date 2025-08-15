"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
exports.validatePdfUpload = validatePdfUpload;
exports.validateUrl = validateUrl;
exports.validateJobPlatform = validateJobPlatform;
exports.validateRateLimit = validateRateLimit;
exports.sanitizeFilename = sanitizeFilename;
exports.sanitizeText = sanitizeText;
exports.createValidationMiddleware = createValidationMiddleware;
const joi_1 = __importDefault(require("joi"));
function validatePdfUpload(file) {
    if (!file) {
        return {
            isValid: false,
            error: '没有上传文件',
        };
    }
    if (file.mimetype !== 'application/pdf') {
        return {
            isValid: false,
            error: '文件格式不正确，只支持PDF文件',
        };
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            isValid: false,
            error: `文件大小超过限制（最大${Math.round(maxSize / 1024 / 1024)}MB）`,
        };
    }
    const allowedExtensions = ['.pdf'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
        return {
            isValid: false,
            error: '文件扩展名不正确，只支持.pdf文件',
        };
    }
    if (file.originalname.length > 255) {
        return {
            isValid: false,
            error: '文件名过长（最大255字符）',
        };
    }
    const suspiciousPatterns = [
        /\.\./,
        /[<>:"|?*]/,
        /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
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
exports.schemas = {
    healthCheck: joi_1.default.object({
        detailed: joi_1.default.boolean().default(false),
    }),
    pdfParse: joi_1.default.object({
        options: joi_1.default.object({
            maxPages: joi_1.default.number().integer().min(0).max(1000).default(0),
            normalizeWhitespace: joi_1.default.boolean().default(true),
        }).default({}),
    }),
    crawlerJob: joi_1.default.object({
        url: joi_1.default.string().uri({
            scheme: ['http', 'https'],
        }).required().messages({
            'string.uri': 'URL格式无效，必须是有效的HTTP或HTTPS地址',
            'any.required': 'URL是必填字段',
        }),
        platform: joi_1.default.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
        options: joi_1.default.object({
            maxPages: joi_1.default.number().integer().min(1).max(10).default(1),
            delay: joi_1.default.number().integer().min(1000).max(10000).default(2000),
            includeDescription: joi_1.default.boolean().default(true),
            includeRequirements: joi_1.default.boolean().default(true),
            timeout: joi_1.default.number().integer().min(5000).max(60000).default(30000),
            retries: joi_1.default.number().integer().min(0).max(5).default(3),
            screenshots: joi_1.default.boolean().default(false),
            waitForSelector: joi_1.default.string().optional(),
            customSelectors: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
        }).default({}),
    }),
    crawlerBatch: joi_1.default.object({
        urls: joi_1.default.array().items(joi_1.default.string().uri({
            scheme: ['http', 'https'],
        }).required()).min(1).max(5).required().messages({
            'array.min': '至少需要提供1个URL',
            'array.max': '最多支持5个URL的批量爬取',
        }),
        platform: joi_1.default.string().valid('zhipin', 'liepin', 'lagou', '51job', 'generic').default('generic'),
        options: joi_1.default.object({
            maxPages: joi_1.default.number().integer().min(1).max(5).default(1),
            delay: joi_1.default.number().integer().min(1000).max(10000).default(2000),
            includeDescription: joi_1.default.boolean().default(true),
            includeRequirements: joi_1.default.boolean().default(true),
            timeout: joi_1.default.number().integer().min(5000).max(60000).default(30000),
            retries: joi_1.default.number().integer().min(0).max(3).default(2),
        }).default({}),
    }),
    cacheDelete: joi_1.default.object({
        pattern: joi_1.default.string().optional(),
        confirm: joi_1.default.boolean().required().valid(true).messages({
            'any.only': '请确认删除操作',
        }),
    }),
};
function validateUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return {
                isValid: false,
                error: 'URL必须使用HTTP或HTTPS协议',
            };
        }
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
    }
    catch (error) {
        return {
            isValid: false,
            error: 'URL格式无效',
        };
    }
}
function validateJobPlatform(platform) {
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
function validateRateLimit(requests, windowMs) {
    if (requests <= 0 || requests > 1000) {
        return {
            isValid: false,
            error: '请求数量必须在1-1000之间',
        };
    }
    if (windowMs < 1000 || windowMs > 3600000) {
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
function sanitizeFilename(filename) {
    return filename
        .replace(/[^\w\s.-]/gi, '')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '')
        .substring(0, 255);
}
function sanitizeText(text) {
    return text
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
}
function createValidationMiddleware(schema) {
    return (req, res, next) => {
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
        req.body = value;
        next();
    };
}
exports.default = {
    validatePdfUpload,
    validateUrl,
    validateJobPlatform,
    validateRateLimit,
    sanitizeFilename,
    sanitizeText,
    createValidationMiddleware,
    schemas: exports.schemas,
};
//# sourceMappingURL=validation.js.map