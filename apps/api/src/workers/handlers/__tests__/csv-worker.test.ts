import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "path";

vi.mock("@/lib/db", () => ({
    prisma: {
        activity: { create: vi.fn() },
    },
}));

vi.mock("fs/promises", () => ({
    default: {
        readFile: vi.fn(),
        unlink: vi.fn(),
    },
}));

vi.mock("@/modules/csv-ingestion/service/csvIngestionService", () => ({
    csvIngestionService: { processCSV: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    logWorker: vi.fn(),
}));

import fs from "fs/promises";
import { prisma } from "@/lib/db";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService";
import { handleCsvImport } from "../csv-worker";

const uploadDir = path.resolve(process.cwd(), "tmp");

describe("csv-worker handleCsvImport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.activity.create as any).mockResolvedValue({});
    });

    it("refuses a filePath outside the upload temp directory, without reading or deleting it", async () => {
        await expect(
            handleCsvImport({ filePath: "/etc/passwd", teamId: "team-a" })
        ).rejects.toThrow("Invalid CSV import file path");

        expect(fs.readFile).not.toHaveBeenCalled();
        expect(fs.unlink).not.toHaveBeenCalled();
    });

    it("refuses a path-traversal filePath that escapes the upload directory via ..", async () => {
        const traversal = path.join(uploadDir, "..", "..", "etc", "passwd");

        await expect(handleCsvImport({ filePath: traversal, teamId: "team-a" })).rejects.toThrow(
            "Invalid CSV import file path"
        );

        expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("processes a filePath inside the upload temp directory", async () => {
        const validPath = path.join(uploadDir, "abc-123.csv");
        (fs.readFile as any).mockResolvedValue(Buffer.from("name,email\nJane,jane@example.com"));
        (csvIngestionService.processCSV as any).mockResolvedValue({
            success: true,
            totalParsed: 1,
            inserted: 1,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const result = await handleCsvImport({ filePath: validPath, teamId: "team-a" });

        expect(fs.readFile).toHaveBeenCalledWith(validPath);
        expect(fs.unlink).toHaveBeenCalledWith(validPath);
        expect(result).toMatchObject({ inserted: 1 });
    });
});
