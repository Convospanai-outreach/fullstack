import { prisma } from "@/lib/db";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService";
import fs from "fs/promises";

/**
 * CSV Import Worker
 * Handles background processing of CSV files
 */
export async function handleCsvImport(payload: {
    filePath: string;
    originalFilename: string;
}) {
    const { filePath, originalFilename } = payload;

    console.log(`📂 Processing CSV import: ${originalFilename}`);

    try {
        // Read file content
        const fileBuffer = await fs.readFile(filePath);
        const csvContent = fileBuffer.toString("utf-8");

        // Use existing service to process
        const result = await csvIngestionService.processCSV(csvContent, null);

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
            console.warn(`Failed to delete temp file ${filePath}:`, e);
        }

        return {
            filename: originalFilename,
            ...result,
        };
    } catch (error) {
        console.error("CSV import failed:", error);
        throw error;
    }
}
