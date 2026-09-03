import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";
import { logger } from "@/lib/logger";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id, region, action } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "Missing Draft ID" }, { status: 400 });
        }

        // Determine correct DB
        const dbRegion = region === 'UAE' ? 'UAE' : 'GLOBAL';
        const prisma = DbFactory.getClient(dbRegion);

        let status = "ACTIONED";
        if (action === "REJECT") {
            status = "REJECTED";
        }

        // Scoped by teamId so a caller can't approve/reject another team's
        // scraping job by guessing its id - same anti-pattern already fixed
        // under OPEN-99/109/110/118/120/121/122/123.
        const updateResult = await prisma.scrapingJob.updateMany({
            where: { id, teamId },
            data: { status }
        });
        if (updateResult.count === 0) {
            return NextResponse.json({ error: "Draft not found" }, { status: 404 });
        }
        const updatedJob = await prisma.scrapingJob.findFirst({ where: { id, teamId } });

        if (status === "ACTIONED") {
            logger.info("[Strike] Agent dispatched", { jobId: id, dbRegion });
        } else {
            logger.info("[Strike] Job rejected", { jobId: id, dbRegion });
        }

        return NextResponse.json({ ok: true, job: updatedJob });

    } catch (error: any) {
        console.error("Failed to process draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
