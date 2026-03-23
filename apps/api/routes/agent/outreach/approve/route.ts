import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";

export async function POST(req: Request) {
    try {
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

        // Update Job Status
        const updatedJob = await prisma.scrapingJob.update({
            where: { id },
            data: { status }
        });

        if (status === "ACTIONED") {
            console.log(`[Strike] Agent dispatched for Job ${id} in ${dbRegion}`);
        } else {
            console.log(`[Strike] Job ${id} rejected in ${dbRegion}`);
        }

        return NextResponse.json({ ok: true, job: updatedJob });

    } catch (error: any) {
        console.error("Failed to process draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
