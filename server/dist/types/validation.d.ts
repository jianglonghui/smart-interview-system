import Joi from 'joi';
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    data?: any;
}
export declare function validatePdfUpload(file: Express.Multer.File): ValidationResult;
export declare const schemas: {
    healthCheck: Joi.ObjectSchema<any>;
    pdfParse: Joi.ObjectSchema<any>;
    crawlerJob: Joi.ObjectSchema<any>;
    crawlerBatch: Joi.ObjectSchema<any>;
    cacheDelete: Joi.ObjectSchema<any>;
};
export declare function validateUrl(url: string): ValidationResult;
export declare function validateJobPlatform(platform: string): ValidationResult;
export declare function validateRateLimit(requests: number, windowMs: number): ValidationResult;
export declare function sanitizeFilename(filename: string): string;
export declare function sanitizeText(text: string): string;
export declare function createValidationMiddleware(schema: Joi.ObjectSchema): (req: any, res: any, next: any) => any;
declare const _default: {
    validatePdfUpload: typeof validatePdfUpload;
    validateUrl: typeof validateUrl;
    validateJobPlatform: typeof validateJobPlatform;
    validateRateLimit: typeof validateRateLimit;
    sanitizeFilename: typeof sanitizeFilename;
    sanitizeText: typeof sanitizeText;
    createValidationMiddleware: typeof createValidationMiddleware;
    schemas: {
        healthCheck: Joi.ObjectSchema<any>;
        pdfParse: Joi.ObjectSchema<any>;
        crawlerJob: Joi.ObjectSchema<any>;
        crawlerBatch: Joi.ObjectSchema<any>;
        cacheDelete: Joi.ObjectSchema<any>;
    };
};
export default _default;
//# sourceMappingURL=validation.d.ts.map