// API service for interview question crawling
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface CrawlOptions {
  category: string;
  keywords?: string[];
  maxQuestions: number;
  targetSites: string[];
}

export interface CrawledQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
  source: string;
  company?: string;
  tags: string[];
  url?: string;
  crawledAt: Date;
}

export interface CrawlResult {
  success: boolean;
  questions: CrawledQuestion[];
  source: string;
  timestamp: number;
  error?: string;
  cached?: boolean;
}

export interface Category {
  value: string;
  label: string;
  keywords: string[];
}

export interface Site {
  value: string;
  label: string;
  enabled: boolean;
}

class InterviewAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/interview`;
  }

  /**
   * Crawl interview questions from multiple sources
   */
  async crawlQuestions(options: CrawlOptions): Promise<CrawlResult> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to crawl questions:', error);
      throw error;
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      const response = await fetch(`${this.baseUrl}/categories`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.categories;
    } catch (error) {
      console.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Get available crawl sites
   */
  async getSites(): Promise<Site[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sites`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.sites;
    } catch (error) {
      console.error('Failed to get sites:', error);
      throw error;
    }
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const interviewApi = new InterviewAPI();