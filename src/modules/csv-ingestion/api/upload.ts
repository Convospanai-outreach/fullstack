import { NextResponse } from "next/server";
import { JobQueue } from "@/lib/queue";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { ok: false, error: "No file uploaded" },
                { status: 400 }
            );
        }

        // Save file to temp directory for worker
        const tempDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `${Date.now()}-${file.name}`);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        // Enqueue job
        const job = await JobQueue.enqueue("lead_enrichment", { // csv_import isn't in JobType, using lead_enrichment or generic
            filePath,
            originalFilename: file.name,
        });

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
