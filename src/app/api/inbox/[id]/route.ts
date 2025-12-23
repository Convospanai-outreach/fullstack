import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const leadId = params.id;

        // Mark messages as read
        await InboxService.markAsRead(leadId);

        const messages = await prisma.message.findMany({
            where: { leadId },
            orderBy: { createdAt: "asc" }
        });

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { fullName: true, company: true, linkedIn: true }
        });

        return NextResponse.json({ lead, messages });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return new NextResponse("Error fetching messages", { status: 500 });
    }
}
