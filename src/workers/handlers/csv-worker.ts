import { prisma } from "@/lib/db";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService";
import fs from "fs/promises";
import { logger, logWorker } from "@/lib/logger";

/**
 * CSV Import Worker
 * Handles background processing of CSV files
 */
export async function handleCsvImport(payload: {
    filePath: string;
    originalFilename: string;
    teamId?: string;
}) {
    const { filePath, originalFilename, teamId } = payload;

    logWorker(originalFilename, "CSV_IMPORT_START", { filePath, teamId });

    try {
        // Read file content
        const fileBuffer = await fs.readFile(filePath);
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
                    filename: originalFilename,
                    parsed: result.totalParsed,
                    inserted: result.inserted,
                },
            },
        });

        // Clean up file
        try {
            await fs.unlink(filePath);
        } catch (e) {
            logger.warn(`[Worker] Failed to delete temp file ${filePath}:`, { error: e instanceof Error ? e.message : e });
        }

        logger.info(`[Worker] CSV import successful: ${originalFilename}`, { inserted: result.inserted });

        return {
            filename: originalFilename,
            ...result,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Worker] CSV import failed: ${originalFilename}`, { error: errorMessage });
        throw error;
    }
}
