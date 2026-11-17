import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const INTERNAL_ERROR_MESSAGE = "Internal server error";

// Rows written to ServerError per process per minute. Past this, errors still reach the log,
// so a failure on every request can't turn into a write on every request.
const MAX_RECORDS_PER_MINUTE = 60;
let windowStart = 0;
let recordedInWindow = 0;

function underRecordLimit(now: number): boolean {
    if (now - windowStart >= 60_000 || now < windowStart) {
        windowStart = now;
        recordedInWindow = 0;
    }
    recordedInWindow += 1;
    return recordedInWindow <= MAX_RECORDS_PER_MINUTE;
}

function warnNotRecorded(err: unknown) {
    logger.warn("[500] Could not record server error", { error: err instanceof Error ? err.message : String(err) });
}

// Best effort: the response must not wait on, or fail because of, this write.
function recordForSuperadmin(fallback: string, details: { name?: string | undefined; message: string; stack?: string | undefined }) {
    if (!underRecordLimit(Date.now())) return;
    try {
        void prisma.serverError.create({
            data: {
                source: "api",
                label: fallback.slice(0, 200),
                name: details.name?.slice(0, 200) ?? null,
                message: details.message.slice(0, 1000),
                stack: details.stack?.slice(0, 8000) ?? null,
            },
        }).catch(warnNotRecorded);
    } catch (err) {
        // The client can throw before returning a promise (no DATABASE_URL, for one).
        warnNotRecorded(err);
    }
}

/**
 * The text a 500 response shows. A caught error's own message can carry SQL, table and column
 * names, hostnames or a provider's reply, so it goes to the server log and the superadmin
 * Server Errors tab, never to the client.
 */
export function internalErrorMessage(error: unknown, fallback: string = INTERNAL_ERROR_MESSAGE): string {
    const details = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };
    logger.error(`[500] ${fallback}`, error instanceof Error ? details : { error: details.message });
    recordForSuperadmin(fallback, details);
    return fallback;
}
