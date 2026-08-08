// src/lib/logger.ts
type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

let loggerInstance: Logger;

const isNodeServer = typeof window === 'undefined' && process.env['NEXT_RUNTIME'] !== 'edge';

if (isNodeServer) {
  // require at runtime on server only (avoids bundling into Edge)
  const winston = require('winston');
  loggerInstance = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  });
  loggerInstance.debug = loggerInstance.info; // Map debug to info for winston
} else {
  // Edge/middleware/browser fallback: no-op logger
  loggerInstance = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

// Support both named and default exports to prevent build failures
export const logger = loggerInstance;
export const logWorker = (id: string, status: string, meta: Record<string, any> = {}) => {
  loggerInstance.info(`[Worker] ${id}: ${status}`, { id, status, ...meta, category: "worker" });
};
export const logCriticalAlert = (event: string, meta: Record<string, any> = {}) => {
  loggerInstance.error(`[CRITICAL_ALERT] ${event}`, {
    event,
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    ...meta,
  });
};
export default loggerInstance;
