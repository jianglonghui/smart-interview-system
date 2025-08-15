import express from 'express';
import Joi from 'joi';
import { getDatabase } from '../config/database';
import { logger } from '../config/logger';

const router = express.Router();

// Validation schemas
const addFavoriteSchema = Joi.object({
  questionId: Joi.string().required(),
  notes: Joi.string().optional().max(1000)
});

const updateFavoriteSchema = Joi.object({
  notes: Joi.string().optional().max(1000)
});

// GET /api/favorites - Get user's favorite questions
router.get('/', async (req, res) => {
  try {
    const { userId = 'default_user', limit = 50, offset = 0 } = req.query;
    
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }

    const db = await getDatabase();
    
    // Get favorites with question details
    const favorites = await db.all(`
      SELECT 
        uf.id as favorite_id,
        uf.notes,
        uf.created_at as favorited_at,
        q.*
      FROM user_favorites uf
      JOIN questions q ON uf.question_id = q.id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limitNum, offsetNum]);

    // Get total count
    const countRow = await db.get(`
      SELECT COUNT(*) as total 
      FROM user_favorites 
      WHERE user_id = ?
    `, [userId]);

    const mappedFavorites = favorites.map(row => ({
      favoriteId: row.favorite_id,
      notes: row.notes,
      favoritedAt: new Date(row.favorited_at),
      question: {
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
      }
    }));

    const hasMore = offsetNum + limitNum < countRow.total;

    res.json({
      success: true,
      data: {
        favorites: mappedFavorites,
        total: countRow.total,
        hasMore
      }
    });
  } catch (error) {
    logger.error('Failed to get favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get favorites'
    });
  }
});

// POST /api/favorites - Add question to favorites
router.post('/', async (req, res) => {
  try {
    const { error, value } = addFavoriteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { questionId, notes } = value;
    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    // Check if question exists
    const question = await db.get('SELECT id FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    // Add to favorites (ignore if already exists)
    try {
      await db.run(`
        INSERT INTO user_favorites (user_id, question_id, notes)
        VALUES (?, ?, ?)
      `, [userId, questionId, notes || null]);

      // Update question favorite count
      await db.run(`
        UPDATE questions 
        SET favorite_count = (
          SELECT COUNT(*) FROM user_favorites WHERE question_id = ?
        )
        WHERE id = ?
      `, [questionId, questionId]);

      res.status(201).json({
        success: true,
        message: 'Question added to favorites'
      });
    } catch (dbError: any) {
      if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          success: false,
          error: 'Question already in favorites'
        });
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('Failed to add favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite'
    });
  }
});

// PUT /api/favorites/:favoriteId - Update favorite notes
router.put('/:favoriteId', async (req, res) => {
  try {
    const favoriteId = parseInt(req.params.favoriteId);
    if (isNaN(favoriteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid favorite ID'
      });
    }

    const { error, value } = updateFavoriteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { notes } = value;
    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    const result = await db.run(`
      UPDATE user_favorites 
      SET notes = ?
      WHERE id = ? AND user_id = ?
    `, [notes || null, favoriteId, userId]);

    if ((result.changes || 0) === 0) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Favorite updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update favorite'
    });
  }
});

// DELETE /api/favorites/:favoriteId - Remove from favorites
router.delete('/:favoriteId', async (req, res) => {
  try {
    const favoriteId = parseInt(req.params.favoriteId);
    if (isNaN(favoriteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid favorite ID'
      });
    }

    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    // Get the question ID before deleting
    const favorite = await db.get(`
      SELECT question_id FROM user_favorites 
      WHERE id = ? AND user_id = ?
    `, [favoriteId, userId]);

    if (!favorite) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    // Remove from favorites
    await db.run(`
      DELETE FROM user_favorites 
      WHERE id = ? AND user_id = ?
    `, [favoriteId, userId]);

    // Update question favorite count
    await db.run(`
      UPDATE questions 
      SET favorite_count = (
        SELECT COUNT(*) FROM user_favorites WHERE question_id = ?
      )
      WHERE id = ?
    `, [favorite.question_id, favorite.question_id]);

    res.json({
      success: true,
      message: 'Question removed from favorites'
    });
  } catch (error) {
    logger.error('Failed to remove favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
});

// DELETE /api/favorites/question/:questionId - Remove question from favorites (alternative endpoint)
router.delete('/question/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    const result = await db.run(`
      DELETE FROM user_favorites 
      WHERE question_id = ? AND user_id = ?
    `, [questionId, userId]);

    if ((result.changes || 0) === 0) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    // Update question favorite count
    await db.run(`
      UPDATE questions 
      SET favorite_count = (
        SELECT COUNT(*) FROM user_favorites WHERE question_id = ?
      )
      WHERE id = ?
    `, [questionId, questionId]);

    res.json({
      success: true,
      message: 'Question removed from favorites'
    });
  } catch (error) {
    logger.error('Failed to remove favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
});

// GET /api/favorites/check/:questionId - Check if question is favorited
router.get('/check/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    const favorite = await db.get(`
      SELECT id, notes, created_at 
      FROM user_favorites 
      WHERE question_id = ? AND user_id = ?
    `, [questionId, userId]);

    res.json({
      success: true,
      data: {
        isFavorited: !!favorite,
        favorite: favorite ? {
          id: favorite.id,
          notes: favorite.notes,
          createdAt: new Date(favorite.created_at)
        } : null
      }
    });
  } catch (error) {
    logger.error('Failed to check favorite status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check favorite status'
    });
  }
});

// GET /api/favorites/stats - Get user's favorite statistics
router.get('/stats', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;

    const db = await getDatabase();
    
    // Total favorites
    const totalRow = await db.get(`
      SELECT COUNT(*) as total 
      FROM user_favorites 
      WHERE user_id = ?
    `, [userId]);

    // By category
    const categoryStats = await db.all(`
      SELECT q.category, COUNT(*) as count
      FROM user_favorites uf
      JOIN questions q ON uf.question_id = q.id
      WHERE uf.user_id = ?
      GROUP BY q.category
      ORDER BY count DESC
    `, [userId]);

    // By difficulty
    const difficultyStats = await db.all(`
      SELECT q.difficulty, COUNT(*) as count
      FROM user_favorites uf
      JOIN questions q ON uf.question_id = q.id
      WHERE uf.user_id = ?
      GROUP BY q.difficulty
    `, [userId]);

    // Recent favorites (last 7 days)
    const recentRow = await db.get(`
      SELECT COUNT(*) as count 
      FROM user_favorites 
      WHERE user_id = ? AND created_at > datetime('now', '-7 days')
    `, [userId]);

    res.json({
      success: true,
      data: {
        total: totalRow.total,
        byCategory: Object.fromEntries(categoryStats.map(s => [s.category, s.count])),
        byDifficulty: Object.fromEntries(difficultyStats.map(s => [s.difficulty, s.count])),
        recentWeek: recentRow.count
      }
    });
  } catch (error) {
    logger.error('Failed to get favorite statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get favorite statistics'
    });
  }
});

export default router;