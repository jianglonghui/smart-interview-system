"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const logger_1 = require("../config/logger");
class PdfService {
    constructor() {
        this.defaultOptions = {
            maxPages: 0,
            version: 'v2.0.550',
            normalizeWhitespace: true,
            disableCombineTextItems: false,
        };
    }
    async parsePdf(filePath, options) {
        try {
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error('PDF文件不存在');
            }
            const fileStats = fs_1.default.statSync(filePath);
            if (fileStats.size === 0) {
                throw new Error('PDF文件为空');
            }
            logger_1.logger.info('Starting PDF parsing', {
                filePath,
                fileSize: fileStats.size,
                options,
            });
            const dataBuffer = fs_1.default.readFileSync(filePath);
            const parseOptions = { ...this.defaultOptions, ...options };
            const data = await (0, pdf_parse_1.default)(dataBuffer, {
                max: parseOptions.maxPages || 0,
                version: parseOptions.version,
            });
            let cleanText = data.text;
            if (parseOptions.normalizeWhitespace) {
                cleanText = this.normalizeText(cleanText);
            }
            const result = {
                text: cleanText,
                pages: data.numpages,
                info: data.info,
                metadata: this.extractMetadata(data.info),
            };
            logger_1.logger.info('PDF parsing completed', {
                pages: result.pages,
                textLength: result.text.length,
                hasMetadata: !!result.metadata,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('PDF parsing failed', {
                filePath,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async validatePdf(filePath) {
        try {
            if (!fs_1.default.existsSync(filePath)) {
                return false;
            }
            const dataBuffer = fs_1.default.readFileSync(filePath);
            if (!this.isPdfFile(dataBuffer)) {
                return false;
            }
            await (0, pdf_parse_1.default)(dataBuffer, { max: 1 });
            return true;
        }
        catch (error) {
            logger_1.logger.warn('PDF validation failed', {
                filePath,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    extractResumeSection(text, section) {
        const sectionPatterns = {
            education: [
                /教育背景[\s\S]*?(?=工作经历|项目经验|专业技能|获奖情况|$)/i,
                /education[\s\S]*?(?=experience|projects|skills|awards|$)/i,
                /学历[\s\S]*?(?=工作|项目|技能|$)/i,
            ],
            experience: [
                /工作经历[\s\S]*?(?=教育背景|项目经验|专业技能|获奖情况|$)/i,
                /experience[\s\S]*?(?=education|projects|skills|awards|$)/i,
                /工作经验[\s\S]*?(?=教育|项目|技能|$)/i,
            ],
            skills: [
                /专业技能[\s\S]*?(?=教育背景|工作经历|项目经验|获奖情况|$)/i,
                /skills[\s\S]*?(?=education|experience|projects|awards|$)/i,
                /技能[\s\S]*?(?=教育|工作|项目|$)/i,
            ],
            contact: [
                /联系方式[\s\S]*?(?=教育背景|工作经历|专业技能|$)/i,
                /contact[\s\S]*?(?=education|experience|skills|$)/i,
                /个人信息[\s\S]*?(?=教育|工作|技能|$)/i,
            ],
        };
        const patterns = sectionPatterns[section];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }
        return '';
    }
    extractContactInfo(text) {
        const contactInfo = {};
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
            contactInfo.email = emailMatch[0];
        }
        const phoneMatch = text.match(/(?:(\+86|86)[\s-]?)?1[3-9]\d{9}|(?:\d{3,4}[-.\s]?)?\d{7,8}/);
        if (phoneMatch) {
            contactInfo.phone = phoneMatch[0];
        }
        const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/profile\/view\?id=)([a-zA-Z0-9-]+)/i);
        if (linkedinMatch) {
            contactInfo.linkedin = linkedinMatch[0];
        }
        const githubMatch = text.match(/(?:github\.com\/)([a-zA-Z0-9-]+)/i);
        if (githubMatch) {
            contactInfo.github = githubMatch[0];
        }
        return contactInfo;
    }
    async getPdfInfo(filePath) {
        try {
            const fileStats = fs_1.default.statSync(filePath);
            const dataBuffer = fs_1.default.readFileSync(filePath);
            const data = await (0, pdf_parse_1.default)(dataBuffer, { max: 0 });
            return {
                pages: data.numpages,
                size: fileStats.size,
                metadata: this.extractMetadata(data.info),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get PDF info', {
                filePath,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    isPdfFile(buffer) {
        const pdfSignature = Buffer.from('%PDF-', 'ascii');
        return buffer.subarray(0, 5).equals(pdfSignature);
    }
    normalizeText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .replace(/\s*([,.;:!?])\s*/g, '$1 ')
            .replace(/•\s+/g, '• ')
            .replace(/\*\s+/g, '* ')
            .replace(/-\s+/g, '- ');
    }
    extractMetadata(info) {
        if (!info)
            return undefined;
        const metadata = {};
        if (info.Title)
            metadata.title = info.Title;
        if (info.Author)
            metadata.author = info.Author;
        if (info.Subject)
            metadata.subject = info.Subject;
        if (info.Creator)
            metadata.creator = info.Creator;
        if (info.Producer)
            metadata.producer = info.Producer;
        if (info.CreationDate) {
            try {
                metadata.creationDate = new Date(info.CreationDate);
            }
            catch (e) {
                logger_1.logger.warn('Failed to parse creation date', { date: info.CreationDate });
            }
        }
        if (info.ModDate) {
            try {
                metadata.modificationDate = new Date(info.ModDate);
            }
            catch (e) {
                logger_1.logger.warn('Failed to parse modification date', { date: info.ModDate });
            }
        }
        return Object.keys(metadata).length > 0 ? metadata : undefined;
    }
}
exports.PdfService = PdfService;
//# sourceMappingURL=PdfService.js.map