import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message} `;
    if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env['LOG_LEVEL'] || 'info',
    format: combine(
        timestamp(),
        process.env.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat)
    ),
    transports: [
        new winston.transports.Console()
    ],
});

/**
 * Log an audit event
 * @param action - The action performed (e.g. 'LOGIN', 'CREATE_CAMPAIGN')
 * @param actorId - User ID identifying the actor
 * @param details - Additional structured data
 */
export const logAudit = (action: string, actorId: string, details: Record<string, any> = {}) => {
    logger.info(`AUDIT: ${action}`, {
        actorId,
        category: 'audit',
        ...details
    });
};

/**
 * Log a worker job event
 * @param jobId - ID of the job
 * @param status - Status update
 * @param details - Context
 */
export const logWorker = (jobId: string, status: string, details?: any) => {
    logger.info(`WORKER: [${jobId}] ${status}`, {
        jobId,
        category: 'worker',
        ...details
    });
};
