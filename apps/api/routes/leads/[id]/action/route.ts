import { NextResponse } from "next/server";
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { action, message } = body; // action: "CONNECT", "MESSAGE"

        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead || !lead.linkedIn) {
            return NextResponse.json({ error: "Lead or LinkedIn URL not found" }, { status: 404 });
        }

        if (action === "CONNECT") {
            await JobQueue.enqueue("linkedin_scraping", {
                leadId: lead.id,
                url: lead.linkedIn
            });
        } else if (action === "MESSAGE") {
            await JobQueue.enqueue("LINKEDIN_ACTION", {
                leadId: lead.id,
                url: lead.linkedIn,
                action: "MESSAGE",
                message: message // Optional override
            });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
