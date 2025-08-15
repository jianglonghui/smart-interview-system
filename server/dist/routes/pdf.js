"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config/config");
const logger_1 = require("../config/logger");
const rateLimiter_1 = require("../config/rateLimiter");
const PdfService_1 = require("../services/PdfService");
const validation_1 = require("../types/validation");
const router = (0, express_1.Router)();
const pdfService = new PdfService_1.PdfService();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(config_1.config.uploadDir, 'pdfs');
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path_1.default.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    },
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    }
    else {
        cb(new Error('只支持PDF文件'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: config_1.config.maxFileSize,
        files: 1,
    },
});
router.post('/parse', rateLimiter_1.uploadRateLimitMiddleware, upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: '没有上传文件',
            message: '请选择一个PDF文件上传',
        });
    }
    const filePath = req.file.path;
    const startTime = Date.now();
    try {
        logger_1.logger.info('Starting PDF parsing', {
            filename: req.file.originalname,
            size: req.file.size,
            path: filePath,
        });
        const validation = (0, validation_1.validatePdfUpload)(req.file);
        if (!validation.isValid) {
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
            return res.status(400).json({
                success: false,
                error: 'PDF文件验证失败',
                message: validation.error,
            });
        }
        const result = await pdfService.parsePdf(filePath);
        const processingTime = Date.now() - startTime;
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        logger_1.logger.info('PDF parsing completed successfully', {
            filename: req.file.originalname,
            pages: result.pages,
            textLength: result.text.length,
            processingTime,
        });
        res.json({
            success: true,
            data: {
                text: result.text,
                pages: result.pages,
                info: result.info,
                metadata: {
                    filename: req.file.originalname,
                    size: req.file.size,
                    processingTime,
                },
            },
        });
    }
    catch (error) {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        logger_1.logger.error('PDF parsing failed', {
            filename: req.file.originalname,
            error: error instanceof Error ? error.message : String(error),
            processingTime: Date.now() - startTime,
        });
        res.status(500).json({
            success: false,
            error: 'PDF解析失败',
            message: error instanceof Error ? error.message : '未知错误',
        });
    }
});
router.post('/validate', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: '没有上传文件',
        });
    }
    const filePath = req.file.path;
    try {
        const validation = (0, validation_1.validatePdfUpload)(req.file);
        const isValidPdf = await pdfService.validatePdf(filePath);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        if (validation.isValid && isValidPdf) {
            res.json({
                success: true,
                message: 'PDF文件有效',
                data: {
                    filename: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                },
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'PDF文件无效',
                message: validation.error || 'PDF文件格式不正确或已损坏',
            });
        }
    }
    catch (error) {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        logger_1.logger.error('PDF validation failed', {
            filename: req.file.originalname,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'PDF验证失败',
            message: error instanceof Error ? error.message : '未知错误',
        });
    }
});
router.get('/info', (req, res) => {
    res.json({
        success: true,
        data: {
            maxFileSize: config_1.config.maxFileSize,
            maxFileSizeMB: Math.round(config_1.config.maxFileSize / 1024 / 1024),
            supportedFormats: ['application/pdf'],
            features: [
                'Text extraction',
                'Metadata extraction',
                'Page count',
                'File validation',
            ],
            limitations: [
                'Image-based PDFs may have limited text extraction',
                'Password-protected PDFs are not supported',
                'Maximum file size: ' + Math.round(config_1.config.maxFileSize / 1024 / 1024) + 'MB',
            ],
        },
    });
});
router.use((error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        let message = 'File upload error';
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = `文件大小超过限制（最大${Math.round(config_1.config.maxFileSize / 1024 / 1024)}MB）`;
                break;
            case 'LIMIT_FILE_COUNT':
                message = '一次只能上传一个文件';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = '意外的文件字段';
                break;
            default:
                message = `文件上传错误: ${error.message}`;
        }
        return res.status(400).json({
            success: false,
            error: 'File upload error',
            message,
        });
    }
    if (error.message === '只支持PDF文件') {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type',
            message: '只支持PDF文件格式',
        });
    }
    next(error);
});
exports.default = router;
//# sourceMappingURL=pdf.js.map