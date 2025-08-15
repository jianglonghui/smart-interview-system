import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { logger } from './logger';

export interface DatabaseConnection extends Database<sqlite3.Database, sqlite3.Statement> {}

let db: DatabaseConnection | null = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<DatabaseConnection> {
  if (db) {
    return db;
  }

  try {
    const dbPath = path.join(process.cwd(), 'data', 'interview_system.db');
    
    // Ensure data directory exists
    const fs = require('fs').promises;
    const dataDir = path.dirname(dbPath);
    await fs.mkdir(dataDir, { recursive: true });

    // Open database connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign key constraints
    await db.exec('PRAGMA foreign_keys = ON');
    
    logger.info('Database connection initialized', { dbPath });
    
    // Create tables
    await createTables();
    
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get database connection
 */
export async function getDatabase(): Promise<DatabaseConnection> {
  if (!db) {
    return await initializeDatabase();
  }
  return db;
}

/**
 * Create database tables
 */
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  try {
    // Questions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        company TEXT,
        tags TEXT, -- JSON array stored as string
        url TEXT,
        crawled_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Question banks table - for organizing questions into collections
    await db.exec(`
      CREATE TABLE IF NOT EXISTS question_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        is_public BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Question bank items - many-to-many relationship
    await db.exec(`
      CREATE TABLE IF NOT EXISTS question_bank_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER NOT NULL,
        question_id TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(bank_id, question_id)
      )
    `);

    // User favorites table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        question_id TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(user_id, question_id)
      )
    `);

    // Crawl history table - track crawl sessions
    await db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        target_sites TEXT NOT NULL, -- JSON array
        max_questions INTEGER NOT NULL,
        keywords TEXT, -- JSON array
        questions_found INTEGER NOT NULL,
        source TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
      CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
      CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);
      CREATE INDEX IF NOT EXISTS idx_questions_company ON questions(company);
      CREATE INDEX IF NOT EXISTS idx_questions_crawled_at ON questions(crawled_at);
      CREATE INDEX IF NOT EXISTS idx_question_banks_category ON question_banks(category);
      CREATE INDEX IF NOT EXISTS idx_question_bank_items_bank_id ON question_bank_items(bank_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_crawl_history_category ON crawl_history(category);
    `);

    // Create triggers for updated_at
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_questions_timestamp 
      AFTER UPDATE ON questions
      BEGIN
        UPDATE questions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_question_banks_timestamp 
      AFTER UPDATE ON question_banks
      BEGIN
        UPDATE question_banks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Failed to create database tables:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  const database = await getDatabase();
  
  try {
    // Check current schema version
    let version = 0;
    try {
      const result = await database.get('SELECT version FROM schema_version LIMIT 1');
      version = result?.version || 0;
    } catch (error) {
      // Schema version table doesn't exist, create it
      await database.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        )
      `);
      await database.run('INSERT INTO schema_version (version) VALUES (0)');
    }

    // Migration 1: Add question statistics
    if (version < 1) {
      await database.exec(`
        ALTER TABLE questions ADD COLUMN view_count INTEGER DEFAULT 0;
        ALTER TABLE questions ADD COLUMN favorite_count INTEGER DEFAULT 0;
      `);
      await database.run('UPDATE schema_version SET version = 1');
      logger.info('Applied migration 1: Added question statistics');
    }

    // Add more migrations here as needed

    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);