import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { logger } from '../config/logger';

export interface PdfParseResult {
  text: string;
  pages: number;
  info: any;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export interface PdfParseOptions {
  maxPages?: number;
  version?: string;
  normalizeWhitespace?: boolean;
  disableCombineTextItems?: boolean;
}

export class PdfService {
  private readonly defaultOptions: PdfParseOptions = {
    maxPages: 0, // 0 means all pages
    version: 'v2.0.550',
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  };

  /**
   * Parse PDF file and extract text content
   */
  public async parsePdf(filePath: string, options?: PdfParseOptions): Promise<PdfParseResult> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF文件不存在');
      }

      const fileStats = fs.statSync(filePath);
      if (fileStats.size === 0) {
        throw new Error('PDF文件为空');
      }

      logger.info('Starting PDF parsing', {
        filePath,
        fileSize: fileStats.size,
        options,
      });

      const dataBuffer = fs.readFileSync(filePath);
      const parseOptions = { ...this.defaultOptions, ...options };

      const data = await pdf(dataBuffer, {
        max: parseOptions.maxPages || 0,
        version: parseOptions.version,
        // Additional parsing options can be added here
      });

      let cleanText = data.text;

      // Normalize whitespace if requested
      if (parseOptions.normalizeWhitespace) {
        cleanText = this.normalizeText(cleanText);
      }

      const result: PdfParseResult = {
        text: cleanText,
        pages: data.numpages,
        info: data.info,
        metadata: this.extractMetadata(data.info),
      };

      logger.info('PDF parsing completed', {
        pages: result.pages,
        textLength: result.text.length,
        hasMetadata: !!result.metadata,
      });

      return result;
    } catch (error) {
      logger.error('PDF parsing failed', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate PDF file without full parsing
   */
  public async validatePdf(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const dataBuffer = fs.readFileSync(filePath);
      
      // Check PDF signature
      if (!this.isPdfFile(dataBuffer)) {
        return false;
      }

      // Try to parse just the first page to validate structure
      await pdf(dataBuffer, { max: 1 });
      return true;
    } catch (error) {
      logger.warn('PDF validation failed', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Extract specific sections from resume text
   */
  public extractResumeSection(text: string, section: 'education' | 'experience' | 'skills' | 'contact'): string {
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

  /**
   * Extract contact information from resume text
   */
  public extractContactInfo(text: string): {
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
  } {
    const contactInfo: any = {};

    // Email pattern
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      contactInfo.email = emailMatch[0];
    }

    // Phone pattern (supports various formats)
    const phoneMatch = text.match(/(?:(\+86|86)[\s-]?)?1[3-9]\d{9}|(?:\d{3,4}[-.\s]?)?\d{7,8}/);
    if (phoneMatch) {
      contactInfo.phone = phoneMatch[0];
    }

    // LinkedIn pattern
    const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/profile\/view\?id=)([a-zA-Z0-9-]+)/i);
    if (linkedinMatch) {
      contactInfo.linkedin = linkedinMatch[0];
    }

    // GitHub pattern
    const githubMatch = text.match(/(?:github\.com\/)([a-zA-Z0-9-]+)/i);
    if (githubMatch) {
      contactInfo.github = githubMatch[0];
    }

    return contactInfo;
  }

  /**
   * Get PDF file information without parsing content
   */
  public async getPdfInfo(filePath: string): Promise<{
    pages: number;
    size: number;
    metadata: any;
  }> {
    try {
      const fileStats = fs.statSync(filePath);
      const dataBuffer = fs.readFileSync(filePath);
      
      const data = await pdf(dataBuffer, { max: 0 });
      
      return {
        pages: data.numpages,
        size: fileStats.size,
        metadata: this.extractMetadata(data.info),
      };
    } catch (error) {
      logger.error('Failed to get PDF info', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if buffer contains a valid PDF file
   */
  private isPdfFile(buffer: Buffer): boolean {
    // PDF files start with %PDF-
    const pdfSignature = Buffer.from('%PDF-', 'ascii');
    return buffer.subarray(0, 5).equals(pdfSignature);
  }

  /**
   * Normalize text by cleaning up whitespace and formatting
   */
  private normalizeText(text: string): string {
    return text
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Replace multiple newlines with double newline
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace
      .trim()
      // Remove excessive whitespace around punctuation
      .replace(/\s*([,.;:!?])\s*/g, '$1 ')
      // Clean up bullet points
      .replace(/•\s+/g, '• ')
      .replace(/\*\s+/g, '* ')
      .replace(/-\s+/g, '- ');
  }

  /**
   * Extract and format metadata from PDF info
   */
  private extractMetadata(info: any): PdfParseResult['metadata'] {
    if (!info) return undefined;

    const metadata: PdfParseResult['metadata'] = {};

    if (info.Title) metadata.title = info.Title;
    if (info.Author) metadata.author = info.Author;
    if (info.Subject) metadata.subject = info.Subject;
    if (info.Creator) metadata.creator = info.Creator;
    if (info.Producer) metadata.producer = info.Producer;
    
    // Handle dates
    if (info.CreationDate) {
      try {
        metadata.creationDate = new Date(info.CreationDate);
      } catch (e) {
        logger.warn('Failed to parse creation date', { date: info.CreationDate });
      }
    }
    
    if (info.ModDate) {
      try {
        metadata.modificationDate = new Date(info.ModDate);
      } catch (e) {
        logger.warn('Failed to parse modification date', { date: info.ModDate });
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
}