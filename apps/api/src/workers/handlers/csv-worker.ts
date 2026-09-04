import { prisma } from "@/lib/db";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService";
import fs from "fs/promises";
import path from "path";
import { logger, logWorker } from "@/lib/logger";

// Must match the temp directory the legitimate upload route
// (csv-ingestion/api/upload.ts) writes to.
const CSV_UPLOAD_DIR = path.resolve(process.cwd(), "tmp");

/**
 * CSV Import Worker
 * Handles background processing of CSV files
 */
export async function handleCsvImport(payload: {
    filePath: string;
    originalFilename?: string;
    teamId?: string;
}) {
    const { filePath, originalFilename, teamId } = payload;
    const filename = originalFilename || filePath;

    logWorker(filename, "CSV_IMPORT_START", { filePath, teamId });

    // filePath is caller-supplied and reachable directly via the generic
    // POST /api/jobs endpoint (OPEN-158) with no path restriction of its
    // own - confine it to the known upload temp directory the legitimate
    // route always writes server-generated filenames into, or a caller
    // could make the worker read (and then delete) an arbitrary file on
    // the API host.
    const resolvedPath = path.resolve(filePath);
    const relativePath = path.relative(CSV_UPLOAD_DIR, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid CSV import file path: ${filePath}`);
    }

    try {
        // Read file content
        const fileBuffer = await fs.readFile(resolvedPath);
        const csvContent = fileBuffer.toString("utf-8");

        // Use existing service to process
        const result = await csvIngestionService.processCSV(csvContent, teamId || null);

        if (!result.success) {
            throw new Error(result.message || "CSV processing failed");
        }

        // Log activity
        await prisma.activity.create({
            data: {
                type: "csv_import_completed",
                meta: {
                    filename,
                    parsed: result.totalParsed,
                    inserted: result.inserted,
                },
            },
        });

        // Clean up file
        try {
            await fs.unlink(resolvedPath);
        } catch (e) {
            logger.warn(`[Worker] Failed to delete temp file ${filePath}:`, { error: e instanceof Error ? e.message : e });
        }

        logger.info(`[Worker] CSV import successful: ${filename}`, { inserted: result.inserted });

        return {
            filename,
            ...result,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Worker] CSV import failed: ${filename}`, { error: errorMessage });
        throw error;
    }
}
