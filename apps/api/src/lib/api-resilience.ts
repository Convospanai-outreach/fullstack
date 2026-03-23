
import { logger } from "@/lib/logger";

interface BackoffOptions {
    retries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
}

const DEFAULT_OPTIONS: Required<BackoffOptions> = {
    retries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a fetch request with exponential backoff on 429/5xx errors
 */
export async function fetchWithBackoff(url: string, options?: RequestInit, backoffOpts?: BackoffOptions): Promise<Response> {
    const config = { ...DEFAULT_OPTIONS, ...backoffOpts };
    let attempt = 0;
    let delay = config.initialDelay;

    while (attempt <= config.retries) {
        try {
            const response = await fetch(url, options);

            // If success or client error (4xx except 429), return immediately
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                return response;
            }

            // If rate limited or server error, throw to trigger retry
            if (response.status === 429 || response.status >= 500) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            return response;

        } catch (error) {
            attempt++;
            if (attempt > config.retries) {
                logger.error(`[FetchBackoff] Failed after ${attempt} attempts: ${url}`, error);
                throw error;
            }

            logger.warn(`[FetchBackoff] Attempt ${attempt} failed, retrying in ${delay}ms...`);
            await sleep(delay);
            delay = Math.min(delay * config.factor, config.maxDelay);
        }
    }

    throw new Error("Unreachable");
}

/**
 * Generic wrapper for any async function with backoff
 */
export async function executeWithBackoff<T>(
    fn: () => Promise<T>,
    backoffOpts?: BackoffOptions
): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...backoffOpts };
    let attempt = 0;
    let delay = config.initialDelay;

    while (attempt <= config.retries) {
        try {
            return await fn();
        } catch (error: any) {
            // Determine if we should retry based on error message or type if possible
            // For now, we retry on all errors unless it's a specific "Abort" or similar
            attempt++;

            if (attempt > config.retries) {
                logger.error(`[ExecBackoff] Function failed after ${attempt} attempts`, error);
                throw error;
            }

            logger.warn(`[ExecBackoff] Attempt ${attempt} failed, retrying in ${delay}ms... Error: ${error.message}`);
            await sleep(delay);
            delay = Math.min(delay * config.factor, config.maxDelay);
        }
    }

    throw new Error("Unreachable");
}
