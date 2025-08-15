import { getDatabase } from '../config/database';
import { logger } from '../config/logger';

export interface Question {
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
  createdAt?: Date;
  updatedAt?: Date;
  viewCount?: number;
  favoriteCount?: number;
}

export interface QuestionQuery {
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  source?: string;
  company?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'crawled_at' | 'view_count' | 'favorite_count';
  sortOrder?: 'ASC' | 'DESC';
}

export class QuestionModel {
  /**
   * Save a single question to database
   */
  static async save(question: Question): Promise<void> {
    const db = await getDatabase();
    
    try {
      await db.run(`
        INSERT OR REPLACE INTO questions (
          id, question, category, difficulty, type, source, company, 
          tags, url, crawled_at, view_count, favorite_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        question.id,
        question.question,
        question.category,
        question.difficulty,
        question.type,
        question.source,
        question.company || null,
        JSON.stringify(question.tags),
        question.url || null,
        question.crawledAt.toISOString(),
        question.viewCount || 0,
        question.favoriteCount || 0
      ]);
      
      logger.debug('Question saved to database', { questionId: question.id });
    } catch (error) {
      logger.error('Failed to save question:', error);
      throw error;
    }
  }

  /**
   * Save multiple questions in a transaction
   */
  static async saveMany(questions: Question[]): Promise<void> {
    const db = await getDatabase();
    
    try {
      await db.exec('BEGIN TRANSACTION');
      
      const stmt = await db.prepare(`
        INSERT OR REPLACE INTO questions (
          id, question, category, difficulty, type, source, company, 
          tags, url, crawled_at, view_count, favorite_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const question of questions) {
        await stmt.run([
          question.id,
          question.question,
          question.category,
          question.difficulty,
          question.type,
          question.source,
          question.company || null,
          JSON.stringify(question.tags),
          question.url || null,
          question.crawledAt.toISOString(),
          question.viewCount || 0,
          question.favoriteCount || 0
        ]);
      }

      await stmt.finalize();
      await db.exec('COMMIT');
      
      logger.info(`Saved ${questions.length} questions to database`);
    } catch (error) {
      await db.exec('ROLLBACK');
      logger.error('Failed to save questions:', error);
      throw error;
    }
  }

  /**
   * Find question by ID
   */
  static async findById(id: string): Promise<Question | null> {
    const db = await getDatabase();
    
    try {
      const row = await db.get(`
        SELECT * FROM questions WHERE id = ?
      `, [id]);
      
      return row ? this.mapRowToQuestion(row) : null;
    } catch (error) {
      logger.error('Failed to find question by ID:', error);
      throw error;
    }
  }

  /**
   * Find questions with filters
   */
  static async find(query: QuestionQuery = {}): Promise<{
    questions: Question[];
    total: number;
    hasMore: boolean;
  }> {
    const db = await getDatabase();
    
    try {
      const {
        category,
        difficulty,
        source,
        company,
        tags,
        search,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = query;

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];

      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }

      if (difficulty) {
        conditions.push('difficulty = ?');
        params.push(difficulty);
      }

      if (source) {
        conditions.push('source = ?');
        params.push(source);
      }

      if (company) {
        conditions.push('company = ?');
        params.push(company);
      }

      if (tags && tags.length > 0) {
        // Search for any of the provided tags
        const tagConditions = tags.map(() => 'tags LIKE ?');
        conditions.push(`(${tagConditions.join(' OR ')})`);
        tags.forEach(tag => params.push(`%"${tag}"%`));
      }

      if (search) {
        conditions.push('(question LIKE ? OR company LIKE ? OR source LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder}`;
      const limitClause = `LIMIT ? OFFSET ?`;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM questions ${whereClause}`;
      const totalRow = await db.get(countQuery, params);
      const total = totalRow.total;

      // Get questions
      const questionsQuery = `
        SELECT * FROM questions 
        ${whereClause} 
        ${orderClause} 
        ${limitClause}
      `;
      const rows = await db.all(questionsQuery, [...params, limit, offset]);
      
      const questions = rows.map(row => this.mapRowToQuestion(row));
      const hasMore = offset + limit < total;

      return { questions, total, hasMore };
    } catch (error) {
      logger.error('Failed to find questions:', error);
      throw error;
    }
  }

  /**
   * Get questions by category with stats
   */
  static async getByCategory(category: string): Promise<{
    questions: Question[];
    stats: {
      total: number;
      byDifficulty: Record<string, number>;
      bySource: Record<string, number>;
      byCompany: Record<string, number>;
    };
  }> {
    const db = await getDatabase();
    
    try {
      // Get questions
      const questions = await this.find({ category, limit: 100 });

      // Get stats
      const difficultyStats = await db.all(`
        SELECT difficulty, COUNT(*) as count 
        FROM questions 
        WHERE category = ? 
        GROUP BY difficulty
      `, [category]);

      const sourceStats = await db.all(`
        SELECT source, COUNT(*) as count 
        FROM questions 
        WHERE category = ? 
        GROUP BY source
      `, [category]);

      const companyStats = await db.all(`
        SELECT company, COUNT(*) as count 
        FROM questions 
        WHERE category = ? AND company IS NOT NULL 
        GROUP BY company
        ORDER BY count DESC
        LIMIT 10
      `, [category]);

      return {
        questions: questions.questions,
        stats: {
          total: questions.total,
          byDifficulty: Object.fromEntries(difficultyStats.map(s => [s.difficulty, s.count])),
          bySource: Object.fromEntries(sourceStats.map(s => [s.source, s.count])),
          byCompany: Object.fromEntries(companyStats.map(s => [s.company, s.count]))
        }
      };
    } catch (error) {
      logger.error('Failed to get questions by category:', error);
      throw error;
    }
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(id: string): Promise<void> {
    const db = await getDatabase();
    
    try {
      await db.run(`
        UPDATE questions 
        SET view_count = view_count + 1 
        WHERE id = ?
      `, [id]);
    } catch (error) {
      logger.error('Failed to increment view count:', error);
      throw error;
    }
  }

  /**
   * Update favorite count
   */
  static async updateFavoriteCount(id: string): Promise<void> {
    const db = await getDatabase();
    
    try {
      const result = await db.get(`
        SELECT COUNT(*) as count 
        FROM user_favorites 
        WHERE question_id = ?
      `, [id]);
      
      await db.run(`
        UPDATE questions 
        SET favorite_count = ? 
        WHERE id = ?
      `, [result.count, id]);
    } catch (error) {
      logger.error('Failed to update favorite count:', error);
      throw error;
    }
  }

  /**
   * Delete question by ID
   */
  static async deleteById(id: string): Promise<boolean> {
    const db = await getDatabase();
    
    try {
      const result = await db.run(`
        DELETE FROM questions WHERE id = ?
      `, [id]);
      
      return (result.changes || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete question:', error);
      throw error;
    }
  }

  /**
   * Get random questions
   */
  static async getRandom(category?: string, limit: number = 10): Promise<Question[]> {
    const db = await getDatabase();
    
    try {
      const whereClause = category ? 'WHERE category = ?' : '';
      const params = category ? [category, limit] : [limit];
      
      const rows = await db.all(`
        SELECT * FROM questions 
        ${whereClause}
        ORDER BY RANDOM() 
        LIMIT ?
      `, params);
      
      return rows.map(row => this.mapRowToQuestion(row));
    } catch (error) {
      logger.error('Failed to get random questions:', error);
      throw error;
    }
  }

  /**
   * Search questions by text
   */
  static async search(searchTerm: string, category?: string, limit: number = 20): Promise<Question[]> {
    const db = await getDatabase();
    
    try {
      const categoryClause = category ? 'AND category = ?' : '';
      const params = category 
        ? [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, category, limit]
        : [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit];
      
      const rows = await db.all(`
        SELECT * FROM questions 
        WHERE (question LIKE ? OR company LIKE ? OR source LIKE ?) 
        ${categoryClause}
        ORDER BY 
          CASE 
            WHEN question LIKE ? THEN 1 
            WHEN company LIKE ? THEN 2 
            ELSE 3 
          END,
          created_at DESC
        LIMIT ?
      `, params);
      
      return rows.map(row => this.mapRowToQuestion(row));
    } catch (error) {
      logger.error('Failed to search questions:', error);
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