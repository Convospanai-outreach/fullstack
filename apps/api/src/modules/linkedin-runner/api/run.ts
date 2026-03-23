import { NextResponse } from "next/server";
import { JobQueue } from "@/lib/queue";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { profileUrl, action, leadId } = body;

        if (!profileUrl || !action) {
            return NextResponse.json(
                { ok: false, error: "profileUrl and action are required" },
                { status: 400 }
            );
        }

        const job = await JobQueue.enqueue("linkedin_scraping", {
            profileUrl,
            action,
            leadId,
        });

        return NextResponse.json({
            ok: true,
            message: "LinkedIn action queued",
            jobId: job.id
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
