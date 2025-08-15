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
export declare class PdfService {
    private readonly defaultOptions;
    parsePdf(filePath: string, options?: PdfParseOptions): Promise<PdfParseResult>;
    validatePdf(filePath: string): Promise<boolean>;
    extractResumeSection(text: string, section: 'education' | 'experience' | 'skills' | 'contact'): string;
    extractContactInfo(text: string): {
        email?: string;
        phone?: string;
        linkedin?: string;
        github?: string;
    };
    getPdfInfo(filePath: string): Promise<{
        pages: number;
        size: number;
        metadata: any;
    }>;
    private isPdfFile;
    private normalizeText;
    private extractMetadata;
}
//# sourceMappingURL=PdfService.d.ts.map