import { NextResponse } from "next/server";
import { JobQueue } from "@/lib/queue";
import { getCurrentContext } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_CSV_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_CSV_TYPES = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel"
]);

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "No active workspace" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const campaignId = formData.get("campaignId") as string | undefined;

        if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
            return NextResponse.json(
                { ok: false, error: "No file uploaded" },
                { status: 400 }
            );
        }

        const originalFilename = file.name || "upload.csv";
        const hasCsvExtension = path.extname(originalFilename).toLowerCase() === ".csv";
        const hasAllowedType = !file.type || ALLOWED_CSV_TYPES.has(file.type.toLowerCase());

        if (!hasCsvExtension || !hasAllowedType) {
            return NextResponse.json(
                { ok: false, error: "Only CSV files are supported" },
                { status: 400 }
            );
        }

        if (file.size > MAX_CSV_UPLOAD_BYTES) {
            return NextResponse.json(
                { ok: false, error: "CSV file is too large" },
                { status: 400 }
            );
        }

        // Save file to temp directory for worker
        const tempDir = path.resolve(process.cwd(), "tmp");
        await fs.mkdir(tempDir, { recursive: true });
        const safeFilename = `${randomUUID()}.csv`;
        const filePath = path.resolve(tempDir, safeFilename);

        const relativeFilePath = path.relative(tempDir, filePath);
        if (relativeFilePath.startsWith("..") || path.isAbsolute(relativeFilePath)) {
            return NextResponse.json(
                { ok: false, error: "Invalid upload path" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        // Enqueue job
        const job = await JobQueue.enqueue("CSV_IMPORT", {
            filePath,
            originalFilename,
            teamId,
            campaignId
        }, { teamId });

        return NextResponse.json({
            ok: true,
            message: "CSV import queued",
            jobId: job.id
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
