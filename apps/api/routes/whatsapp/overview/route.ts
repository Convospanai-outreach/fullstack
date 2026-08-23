import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Team-wide WhatsApp status for the dashboard: recent conversation activity
// plus consent counts. Read-only - sending still goes through /whatsapp/send.
export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);

    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [messages, consented, totalLeadsWithPhone] = await Promise.all([
            prisma.whatsAppMessage.findMany({
                where: { lead: { teamId } },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    body: true,
                    direction: true,
                    status: true,
                    createdAt: true,
                    lead: { select: { id: true, fullName: true, email: true, phone: true } },
                },
            }),
            prisma.lead.count({ where: { teamId, whatsappConsent: true } }),
            prisma.lead.count({ where: { teamId, phone: { not: null } } }),
        ]);

        return NextResponse.json({
            messages: messages.map((m) => ({
                id: m.id,
                body: m.body,
                direction: m.direction,
                status: m.status,
                createdAt: m.createdAt,
                lead: m.lead,
            })),
            stats: {
                consentedLeads: consented,
                leadsWithPhone: totalLeadsWithPhone,
            },
        });
    } catch (error: any) {
        console.error("WhatsApp overview error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
