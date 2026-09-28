// Streaming CSV response helper for large exports. Instead of loading every row
// and building one giant string in memory (roadmap I-04 / 2.11), the caller
// provides a header line and an async generator that yields already-formatted
// CSV chunks (typically one DB batch at a time). The body is a ReadableStream
// and carries the internal `x-stream-body` marker the Fastify adapter
// (server.ts) uses to pipe it through rather than buffer it.

import { logger } from "@/lib/logger";

/** Cells a spreadsheet would evaluate as a formula (OWASP CSV injection). No `m`
 *  flag and no trailing `.*$`, so a multi-line cell like "=1+1\nx" still matches. */
export const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Prefixes a formula-triggering cell with `'` so spreadsheets treat it as text.
 *  Apply before quote-escaping, and quote any cell containing `,` `"` CR or LF -
 *  otherwise a separator inside the cell starts a new, un-neutralized one. */
export function neutralizeCsvFormula(value: string): string {
    return CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function streamingCsvResponse(opts: {
    filename: string;
    /** Column header line, WITHOUT a trailing newline. */
    header: string;
    /** Yields successive CSV chunks. Each chunk is one or more rows joined by
     *  "\n" and WITHOUT a leading or trailing newline. */
    chunks: () => AsyncGenerator<string>;
    /** Label for the server-side log if the stream fails mid-export. */
    logLabel: string;
}): Response {
    const encoder = new TextEncoder();
    const iterator = opts.chunks();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(opts.header));
        },
        async pull(controller) {
            try {
                const { value, done } = await iterator.next();
                if (done) {
                    controller.close();
                    return;
                }
                controller.enqueue(encoder.encode("\n" + value));
            } catch (err) {
                // The response is already streaming with a 200 and sent headers,
                // so the route's try/catch can't turn this into a 500 - the client
                // just gets a truncated CSV. Leave a server-side trace so a partial
                // export isn't silently invisible, then abort the stream.
                logger.error(`[csvStream] ${opts.logLabel} failed mid-stream; export is truncated`, {
                    error: err instanceof Error ? err.message : String(err),
                });
                controller.error(err);
            }
        },
        async cancel() {
            // Client aborted the download - let the generator release its DB cursor.
            await iterator.return?.(undefined);
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${opts.filename}"`,
            "x-stream-body": "1",
        },
    });
}
