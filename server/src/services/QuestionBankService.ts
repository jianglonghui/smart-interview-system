import { QuestionModel, Question, QuestionQuery } from '../models/Question';
import { logger } from '../config/logger';
import { getDatabase } from '../config/database';

export interface QuestionBank {
  id?: number;
  name: string;
  description?: string;
  category: string;
  createdBy: string;
  isPublic: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QuestionBankWithStats extends QuestionBank {
  questionCount: number;
  questions?: Question[];
}

export interface CrawlHistoryEntry {
  id?: number;
  category: string;
  targetSites: string[];
  maxQuestions: number;
  keywords?: string[];
  questionsFound: number;
  source: string;
  success: boolean;
  errorMessage?: string;
  crawledAt?: Date;
}

export class QuestionBankService {
  /**
   * Save crawled questions to database
   */
  static async saveCrawledQuestions(questions: Question[]): Promise<void> {
    if (questions.length === 0) return;

    try {
      await QuestionModel.saveMany(questions);
      logger.info(`Saved ${questions.length} questions to database`);
    } catch (error) {
      logger.error('Failed to save crawled questions:', error);
      throw error;
    }
  }

  /**
   * Create a new question bank
   */
  static async createQuestionBank(questionBank: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const db = await getDatabase();
    
    try {
      const result = await db.run(`
        INSERT INTO question_banks (name, description, category, created_by, is_public)
        VALUES (?, ?, ?, ?, ?)
      `, [
        questionBank.name,
        questionBank.description || null,
        questionBank.category,
        questionBank.createdBy,
        questionBank.isPublic ? 1 : 0
      ]);

      const bankId = result.lastID as number;
      logger.info('Created question bank', { bankId, name: questionBank.name });
      return bankId;
    } catch (error) {
      logger.error('Failed to create question bank:', error);
      throw error;
    }
  }

  /**
   * Get question bank by ID with questions
   */
  static async getQuestionBankById(id: number): Promise<QuestionBankWithStats | null> {
    const db = await getDatabase();
    
    try {
      const bankRow = await db.get(`
        SELECT * FROM question_banks WHERE id = ?
      `, [id]);

      if (!bankRow) return null;

      // Get question count
      const countRow = await db.get(`
        SELECT COUNT(*) as count 
        FROM question_bank_items 
        WHERE bank_id = ?
      `, [id]);

      // Get questions
      const questionRows = await db.all(`
        SELECT q.* 
        FROM questions q
        JOIN question_bank_items qbi ON q.id = qbi.question_id
        WHERE qbi.bank_id = ?
        ORDER BY qbi.position, q.created_at DESC
      `, [id]);

      const questions = questionRows.map(row => this.mapRowToQuestion(row));

      return {
        id: bankRow.id,
        name: bankRow.name,
        description: bankRow.description,
        category: bankRow.category,
        createdBy: bankRow.created_by,
        isPublic: bankRow.is_public === 1,
        createdAt: new Date(bankRow.created_at),
        updatedAt: new Date(bankRow.updated_at),
        questionCount: countRow.count,
        questions
      };
    } catch (error) {
      logger.error('Failed to get question bank:', error);
      throw error;
    }
  }

  /**
   * Get all question banks with stats
   */
  static async getQuestionBanks(category?: string, createdBy?: string): Promise<QuestionBankWithStats[]> {
    const db = await getDatabase();
    
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      if (createdBy) {
        whereClause += ' AND created_by = ?';
        params.push(createdBy);
      }

      const banks = await db.all(`
        SELECT 
          qb.*,
          COUNT(qbi.question_id) as question_count
        FROM question_banks qb
        LEFT JOIN question_bank_items qbi ON qb.id = qbi.bank_id
        ${whereClause}
        GROUP BY qb.id
        ORDER BY qb.created_at DESC
      `, params);

      return banks.map(bank => ({
        id: bank.id,
        name: bank.name,
        description: bank.description,
        category: bank.category,
        createdBy: bank.created_by,
        isPublic: bank.is_public === 1,
        createdAt: new Date(bank.created_at),
        updatedAt: new Date(bank.updated_at),
        questionCount: bank.question_count
      }));
    } catch (error) {
      logger.error('Failed to get question banks:', error);
      throw error;
    }
  }

  /**
   * Add questions to a question bank
   */
  static async addQuestionsToBank(bankId: number, questionIds: string[]): Promise<void> {
    const db = await getDatabase();
    
    try {
      await db.exec('BEGIN TRANSACTION');
      
      const stmt = await db.prepare(`
        INSERT OR IGNORE INTO question_bank_items (bank_id, question_id, position)
        VALUES (?, ?, ?)
      `);

      for (let i = 0; i < questionIds.length; i++) {
        await stmt.run([bankId, questionIds[i], i]);
      }

      await stmt.finalize();
      await db.exec('COMMIT');
      
      logger.info(`Added ${questionIds.length} questions to bank ${bankId}`);
    } catch (error) {
      await db.exec('ROLLBACK');
      logger.error('Failed to add questions to bank:', error);
      throw error;
    }
  }

  /**
   * Remove questions from a question bank
   */
  static async removeQuestionsFromBank(bankId: number, questionIds: string[]): Promise<void> {
    const db = await getDatabase();
    
    try {
      const placeholders = questionIds.map(() => '?').join(',');
      await db.run(`
        DELETE FROM question_bank_items 
        WHERE bank_id = ? AND question_id IN (${placeholders})
      `, [bankId, ...questionIds]);
      
      logger.info(`Removed ${questionIds.length} questions from bank ${bankId}`);
    } catch (error) {
      logger.error('Failed to remove questions from bank:', error);
      throw error;
    }
  }

  /**
   * Delete a question bank
   */
  static async deleteQuestionBank(id: number): Promise<boolean> {
    const db = await getDatabase();
    
    try {
      const result = await db.run(`
        DELETE FROM question_banks WHERE id = ?
      `, [id]);
      
      return (result.changes || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete question bank:', error);
      throw error;
    }
  }

  /**
   * Get questions with advanced filtering
   */
  static async getQuestions(query: QuestionQuery = {}): Promise<{
    questions: Question[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      return await QuestionModel.find(query);
    } catch (error) {
      logger.error('Failed to get questions:', error);
      throw error;
    }
  }

  /**
   * Get questions by category with statistics
   */
  static async getQuestionsByCategory(category: string): Promise<{
    questions: Question[];
    stats: {
      total: number;
      byDifficulty: Record<string, number>;
      bySource: Record<string, number>;
      byCompany: Record<string, number>;
    };
  }> {
    try {
      return await QuestionModel.getByCategory(category);
    } catch (error) {
      logger.error('Failed to get questions by category:', error);
      throw error;
    }
  }

  /**
   * Get random questions
   */
  static async getRandomQuestions(category?: string, limit: number = 10): Promise<Question[]> {
    try {
      return await QuestionModel.getRandom(category, limit);
    } catch (error) {
      logger.error('Failed to get random questions:', error);
      throw error;
    }
  }

  /**
   * Search questions
   */
  static async searchQuestions(searchTerm: string, category?: string, limit: number = 20): Promise<Question[]> {
    try {
      return await QuestionModel.search(searchTerm, category, limit);
    } catch (error) {
      logger.error('Failed to search questions:', error);
      throw error;
    }
  }

  /**
   * Log crawl history
   */
  static async logCrawlHistory(entry: Omit<CrawlHistoryEntry, 'id' | 'crawledAt'>): Promise<void> {
    const db = await getDatabase();
    
    try {
      await db.run(`
        INSERT INTO crawl_history (
          category, target_sites, max_questions, keywords, 
          questions_found, source, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entry.category,
        JSON.stringify(entry.targetSites),
        entry.maxQuestions,
        entry.keywords ? JSON.stringify(entry.keywords) : null,
        entry.questionsFound,
        entry.source,
        entry.success ? 1 : 0,
        entry.errorMessage || null
      ]);
      
      logger.debug('Logged crawl history entry');
    } catch (error) {
      logger.error('Failed to log crawl history:', error);
      throw error;
    }
  }

  /**
   * Get crawl history
   */
  static async getCrawlHistory(category?: string, limit: number = 50): Promise<CrawlHistoryEntry[]> {
    const db = await getDatabase();
    
    try {
      const whereClause = category ? 'WHERE category = ?' : '';
      const params = category ? [category, limit] : [limit];
      
      const rows = await db.all(`
        SELECT * FROM crawl_history 
        ${whereClause}
        ORDER BY crawled_at DESC 
        LIMIT ?
      `, params);
      
      return rows.map(row => ({
        id: row.id,
        category: row.category,
        targetSites: JSON.parse(row.target_sites),
        maxQuestions: row.max_questions,
        keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
        questionsFound: row.questions_found,
        source: row.source,
        success: row.success === 1,
        errorMessage: row.error_message,
        crawledAt: new Date(row.crawled_at)
      }));
    } catch (error) {
      logger.error('Failed to get crawl history:', error);
      throw error;
    }
  }

  /**
   * Get question statistics
   */
  static async getStatistics(): Promise<{
    totalQuestions: number;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
    bySource: Record<string, number>;
    recentCrawls: number;
  }> {
    const db = await getDatabase();
    
    try {
      // Total questions
      const totalRow = await db.get('SELECT COUNT(*) as total FROM questions');
      
      // By category
      const categoryRows = await db.all(`
        SELECT category, COUNT(*) as count 
        FROM questions 
        GROUP BY category 
        ORDER BY count DESC
      `);
      
      // By difficulty
      const difficultyRows = await db.all(`
        SELECT difficulty, COUNT(*) as count 
        FROM questions 
        GROUP BY difficulty
      `);
      
      // By source
      const sourceRows = await db.all(`
        SELECT source, COUNT(*) as count 
        FROM questions 
        GROUP BY source 
        ORDER BY count DESC
      `);
      
      // Recent crawls (last 7 days)
      const recentCrawlsRow = await db.get(`
        SELECT COUNT(*) as count 
        FROM crawl_history 
        WHERE crawled_at > datetime('now', '-7 days')
      `);

      return {
        totalQuestions: totalRow.total,
        byCategory: Object.fromEntries(categoryRows.map(r => [r.category, r.count])),
        byDifficulty: Object.fromEntries(difficultyRows.map(r => [r.difficulty, r.count])),
        bySource: Object.fromEntries(sourceRows.map(r => [r.source, r.count])),
        recentCrawls: recentCrawlsRow.count
      };
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Initialize question bank with sample data if empty
   */
  static async initializeWithSampleData(): Promise<void> {
    const db = await getDatabase();
    
    try {
      // Check if we have any questions
      const countRow = await db.get('SELECT COUNT(*) as count FROM questions');
      
      if (countRow.count > 0) {
        logger.info('Database already has questions, skipping sample data initialization');
        return;
      }

      // Create default question banks for each category
      const categories = ['前端开发', '后端开发', '算法岗', '测试开发', '运维开发', '产品经理', '数据分析'];
      
      for (const category of categories) {
        const bankId = await this.createQuestionBank({
          name: `${category}题库`,
          description: `${category}相关面试题集合`,
          category,
          createdBy: 'system',
          isPublic: true
        });
        
        logger.info(`Created default question bank for ${category}`, { bankId });
      }
      
      logger.info('Initialized question banks with sample data');
    } catch (error) {
      logger.error('Failed to initialize sample data:', error);
      throw error;
    }
  }

  /**
   * Map database row to Question object
   */
  private static mapRowToQuestion(row: any): Question {
    return {
      id: row.id,
      question: row.question,
      category: row.category,
      difficulty: row.difficulty,
      type: row.type,
      source: row.source,
      company: row.company,
      tags: row.tags ? JSON.parse(row.tags) : [],
      url: row.url,
      crawledAt: new Date(row.crawled_at),
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      viewCount: row.view_count || 0,
      favoriteCount: row.favorite_count || 0
    };
  }
}