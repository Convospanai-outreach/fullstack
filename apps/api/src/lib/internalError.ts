import { logger } from "@/lib/logger";

export const INTERNAL_ERROR_MESSAGE = "Internal server error";

/**
 * The text a 500 response shows. A caught error's own message can carry SQL, table and column
 * names, hostnames or a provider's reply, so it goes to the server log and never to the client.
 */
export function internalErrorMessage(error: unknown, fallback: string = INTERNAL_ERROR_MESSAGE): string {
    logger.error(`[500] ${fallback}`, error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error: String(error) });
    return fallback;
}
