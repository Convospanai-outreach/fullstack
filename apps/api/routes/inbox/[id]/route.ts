import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { id: leadId } = await params;

        const lead = await prisma.lead.findUnique({
            where: { id: leadId, teamId: ctx.teamId },
            select: { fullName: true, company: true, linkedIn: true, jobTitle: true }
        });

        if (!lead) return new NextResponse("Lead not found", { status: 404 });

        // Mark messages as read - only after ownership is confirmed above, since
        // markAsRead has no teamId scope of its own.
        await InboxService.markAsRead(leadId);

        const messages = await prisma.message.findMany({
            where: { leadId },
            orderBy: { createdAt: "asc" }
        });

        return NextResponse.json({ lead, messages });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return new NextResponse("Error fetching messages", { status: 500 });
    }
}
