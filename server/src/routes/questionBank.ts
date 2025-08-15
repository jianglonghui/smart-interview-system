import express from 'express';
import Joi from 'joi';
import { QuestionBankService } from '../services/QuestionBankService';
import { logger } from '../config/logger';

const router = express.Router();

// Validation schemas
const createBankSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  category: Joi.string().required().valid(
    '前端开发', '后端开发', '算法岗', '测试开发', '运维开发', '产品经理', '数据分析'
  ),
  createdBy: Joi.string().optional().default('default_user'),
  isPublic: Joi.boolean().optional().default(true)
});

const querySchema = Joi.object({
  category: Joi.string().optional(),
  difficulty: Joi.string().optional().valid('easy', 'medium', 'hard'),
  source: Joi.string().optional(),
  company: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  search: Joi.string().optional(),
  limit: Joi.number().optional().min(1).max(100).default(20),
  offset: Joi.number().optional().min(0).default(0),
  sortBy: Joi.string().optional().valid('created_at', 'crawled_at', 'view_count', 'favorite_count').default('created_at'),
  sortOrder: Joi.string().optional().valid('ASC', 'DESC').default('DESC')
});

const addQuestionsSchema = Joi.object({
  questionIds: Joi.array().items(Joi.string()).required().min(1)
});

// GET /api/question-bank/banks - Get all question banks
router.get('/banks', async (req, res) => {
  try {
    const { category, createdBy } = req.query;
    
    const banks = await QuestionBankService.getQuestionBanks(
      category as string,
      createdBy as string
    );
    
    res.json({
      success: true,
      data: banks
    });
  } catch (error) {
    logger.error('Failed to get question banks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get question banks'
    });
  }
});

// POST /api/question-bank/banks - Create a new question bank
router.post('/banks', async (req, res) => {
  try {
    const { error, value } = createBankSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const bankId = await QuestionBankService.createQuestionBank(value);
    
    res.status(201).json({
      success: true,
      data: { id: bankId }
    });
  } catch (error) {
    logger.error('Failed to create question bank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question bank'
    });
  }
});

// GET /api/question-bank/banks/:id - Get question bank by ID
router.get('/banks/:id', async (req, res) => {
  try {
    const bankId = parseInt(req.params.id);
    if (isNaN(bankId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bank ID'
      });
    }

    const bank = await QuestionBankService.getQuestionBankById(bankId);
    if (!bank) {
      return res.status(404).json({
        success: false,
        error: 'Question bank not found'
      });
    }
    
    res.json({
      success: true,
      data: bank
    });
  } catch (error) {
    logger.error('Failed to get question bank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get question bank'
    });
  }
});

// DELETE /api/question-bank/banks/:id - Delete question bank
router.delete('/banks/:id', async (req, res) => {
  try {
    const bankId = parseInt(req.params.id);
    if (isNaN(bankId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bank ID'
      });
    }

    const deleted = await QuestionBankService.deleteQuestionBank(bankId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Question bank not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Question bank deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete question bank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete question bank'
    });
  }
});

// POST /api/question-bank/banks/:id/questions - Add questions to bank
router.post('/banks/:id/questions', async (req, res) => {
  try {
    const bankId = parseInt(req.params.id);
    if (isNaN(bankId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bank ID'
      });
    }

    const { error, value } = addQuestionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    await QuestionBankService.addQuestionsToBank(bankId, value.questionIds);
    
    res.json({
      success: true,
      message: `Added ${value.questionIds.length} questions to bank`
    });
  } catch (error) {
    logger.error('Failed to add questions to bank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add questions to bank'
    });
  }
});

// DELETE /api/question-bank/banks/:id/questions - Remove questions from bank
router.delete('/banks/:id/questions', async (req, res) => {
  try {
    const bankId = parseInt(req.params.id);
    if (isNaN(bankId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bank ID'
      });
    }

    const { error, value } = addQuestionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    await QuestionBankService.removeQuestionsFromBank(bankId, value.questionIds);
    
    res.json({
      success: true,
      message: `Removed ${value.questionIds.length} questions from bank`
    });
  } catch (error) {
    logger.error('Failed to remove questions from bank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove questions from bank'
    });
  }
});

// GET /api/question-bank/questions - Get questions with filtering
router.get('/questions', async (req, res) => {
  try {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const result = await QuestionBankService.getQuestions(value);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get questions'
    });
  }
});

// GET /api/question-bank/questions/category/:category - Get questions by category with stats
router.get('/questions/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await QuestionBankService.getQuestionsByCategory(category);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get questions by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get questions by category'
    });
  }
});

// GET /api/question-bank/questions/random - Get random questions
router.get('/questions/random', async (req, res) => {
  try {
    const { category, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 10;
    
    if (limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 50'
      });
    }

    const questions = await QuestionBankService.getRandomQuestions(
      category as string,
      limitNum
    );
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    logger.error('Failed to get random questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get random questions'
    });
  }
});

// GET /api/question-bank/questions/search - Search questions
router.get('/questions/search', async (req, res) => {
  try {
    const { q, category, limit } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const limitNum = limit ? parseInt(limit as string) : 20;
    if (limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 50'
      });
    }

    const questions = await QuestionBankService.searchQuestions(
      q.trim(),
      category as string,
      limitNum
    );
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    logger.error('Failed to search questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search questions'
    });
  }
});

// GET /api/question-bank/statistics - Get overall statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await QuestionBankService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// GET /api/question-bank/history - Get crawl history
router.get('/history', async (req, res) => {
  try {
    const { category, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 50;
    
    if (limitNum < 1 || limitNum > 200) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 200'
      });
    }

    const history = await QuestionBankService.getCrawlHistory(
      category as string,
      limitNum
    );
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Failed to get crawl history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get crawl history'
    });
  }
});

export default router;