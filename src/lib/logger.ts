
let internalLogger: any;

if (process.env['NEXT_RUNTIME'] === 'nodejs') {
  // Use require for Node.js specific modules to avoid Edge runtime issues
  const winston = require('winston');
  const { combine, timestamp, json, colorize, printf, errors } = winston.format;

  const devFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, stack }: any) => {
      return `${timestamp} [${level}]: ${stack || message}`;
    })
  );

  const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug');

  internalLogger = winston.createLogger({
    level: logLevel,
    format: isProduction ? prodFormat : devFormat,
    defaultMeta: { service: 'convospan-api' },
    transports: [
      new winston.transports.Console(),
    ],
  });
} else {
  // Edge/Browser Fallback
  internalLogger = {
    info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
    error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
    warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
    debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
    child: () => internalLogger,
  };
}

export const logger = internalLogger;

// Create a stream for Morgan/HTTP loggers if needed
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Worker-specific logger alias for background jobs
const logWorkerInternal = (id: string, message: string, meta?: any) => {
  logger.info(message, { jobId: id, ...meta });
};

export const logWorker = Object.assign(logWorkerInternal, logger) as any;
