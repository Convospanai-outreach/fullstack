import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const leadId = params.id;

        // MOCK DATA HANDLER
        if (leadId.startsWith("mock-")) {
            // Return appropriate mock details
            let mockLead;
            let mockMessages: any[] = [];

            if (leadId === "mock-1") {
                mockLead = { fullName: "Sarah Chen", company: "TechCorp", linkedIn: null, jobTitle: "CTO" };
                mockMessages = [
                    { id: "m1", content: "Hi team, I saw your product demo.", sender: "them", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
                    { id: "m2", content: "Great to hear Sarah! Any specific questions?", sender: "me", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
                    { id: "m3", content: "Assuming we can integrate this by Q3, what would the pricing look like for 50 seats?", sender: "them", createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() }
                ];
            } else {
                mockLead = { fullName: "Demo User", company: "Demo Corp", linkedIn: null, jobTitle: "Lead" };
                mockMessages = [];
            }

            return NextResponse.json({ lead: mockLead, messages: mockMessages });
        }

        // Mark messages as read
        await InboxService.markAsRead(leadId);

        const messages = await prisma.message.findMany({
            where: { leadId },
            orderBy: { createdAt: "asc" }
        });

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { fullName: true, company: true, linkedIn: true, jobTitle: true }
        });

        return NextResponse.json({ lead, messages });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return new NextResponse("Error fetching messages", { status: 500 });
    }
}
