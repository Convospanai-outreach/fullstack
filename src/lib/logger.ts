
import winston from 'winston';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Standard log format for development
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// JSON format for production (easy ingestion by DataDog/Sentry/Splunk)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug');

/**
 * Structured Logger using Winston
 * 
 * Usage:
 * import { logger } from '@/lib/logger';
 * 
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Database connection failed', error);
 * logger.warn('Rate limit approaching', { ip: '192.168.1.1' });
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'convospan-api' },
  transports: [
    new winston.transports.Console(),
    // Add file transport implementation if needed
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Create a stream for Morgan/HTTP loggers if needed
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Worker-specific logger alias for background jobs
// We use Object.assign to make the function also have all winston.Logger methods
const logWorkerInternal = (id: string, message: string, meta?: any) => {
  logger.info(message, { jobId: id, ...meta });
};

export const logWorker = Object.assign(logWorkerInternal, logger) as any;
