import winston from 'winston';
import path from 'path';
import { config } from './config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(config.logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(config.logDir, 'combined.log'),
    format: fileFormat,
  }),
];

// Create the logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  levels,
  transports,
  exitOnError: false,
});

// Add request logging middleware
export const requestLogger = winston.createLogger({
  level: 'http',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(config.logDir, 'requests.log'),
    }),
  ],
});

// Stream for Morgan HTTP request logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;