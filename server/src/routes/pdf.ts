import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import { logger } from '../config/logger';
import { uploadRateLimitMiddleware } from '../config/rateLimiter';
import { PdfService } from '../services/PdfService';
import { validatePdfUpload } from '../types/validation';

const router = Router();
const pdfService = new PdfService();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(config.uploadDir, 'pdfs');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only allow PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('只支持PDF文件'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: 1,
  },
});

/**
 * POST /api/pdf/parse
 * Parse PDF file and extract text content
 */
router.post('/parse', uploadRateLimitMiddleware, upload.single('pdf'), async (req: Request, res: Response) => {
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
    logger.info('Starting PDF parsing', {
      filename: req.file.originalname,
      size: req.file.size,
      path: filePath,
    });

    // Validate the uploaded file
    const validation = validatePdfUpload(req.file);
    if (!validation.isValid) {
      // Clean up file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(400).json({
        success: false,
        error: 'PDF文件验证失败',
        message: validation.error,
      });
    }

    // Parse the PDF
    const result = await pdfService.parsePdf(filePath);
    const processingTime = Date.now() - startTime;

    // Clean up the uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    logger.info('PDF parsing completed successfully', {
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
  } catch (error) {
    // Clean up file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    logger.error('PDF parsing failed', {
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

/**
 * POST /api/pdf/validate
 * Validate PDF file without parsing (quick check)
 */
router.post('/validate', upload.single('pdf'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: '没有上传文件',
    });
  }

  const filePath = req.file.path;

  try {
    const validation = validatePdfUpload(req.file);
    const isValidPdf = await pdfService.validatePdf(filePath);

    // Clean up file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
    } else {
      res.status(400).json({
        success: false,
        error: 'PDF文件无效',
        message: validation.error || 'PDF文件格式不正确或已损坏',
      });
    }
  } catch (error) {
    // Clean up file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    logger.error('PDF validation failed', {
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

/**
 * GET /api/pdf/info
 * Get information about PDF processing capabilities
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      maxFileSize: config.maxFileSize,
      maxFileSizeMB: Math.round(config.maxFileSize / 1024 / 1024),
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
        'Maximum file size: ' + Math.round(config.maxFileSize / 1024 / 1024) + 'MB',
      ],
    },
  });
});

// Error handling middleware for multer errors
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `文件大小超过限制（最大${Math.round(config.maxFileSize / 1024 / 1024)}MB）`;
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

  // Pass to next error handler
  next(error);
});

export default router;