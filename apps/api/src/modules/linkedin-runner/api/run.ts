import { NextResponse } from "next/server";
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { profileUrl, action, leadId } = body;

        if (!profileUrl || !action) {
            return NextResponse.json(
                { ok: false, error: "profileUrl and action are required" },
                { status: 400 }
            );
        }

        // leadId is optional (a bare profile scrape needs no lead), but when
        // provided it must belong to the caller's own team - otherwise this
        // route would let any authenticated user trigger outbound LinkedIn
        // automation against, and overwrite the status of, another team's lead.
        if (leadId) {
            const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
            if (!lead) {
                return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
            }
        }

        const job = await JobQueue.enqueue("linkedin_scraping", {
            profileUrl,
            action,
            leadId,
            teamId,
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
