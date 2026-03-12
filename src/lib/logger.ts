// src/lib/logger.ts
type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
};

let logger: Logger;

const isNodeServer = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge';

if (isNodeServer) {
  // require at runtime on server only (avoids bundling into Edge)
  const winston = require('winston');
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  });
} else {
  // Edge/middleware/browser fallback: no-op logger
  logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

export default logger;
