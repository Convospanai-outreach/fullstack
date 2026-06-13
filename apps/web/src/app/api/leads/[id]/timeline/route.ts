import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

export const dynamic = "force-dynamic";

async function resolveTeamId() {
    const context = await getCurrentContext();
    if (context.teamId) return context.teamId;
    const user = await findOrCreateClerkAppUser();
    return user?.memberships.find((member) => member.status === "active")?.teamId || null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { prisma } = await import("@/lib/db");
    const { id } = await params;
    const teamId = await resolveTeamId();
    if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lead = await prisma.lead.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const [events, emails, leadActivities] = await Promise.all([
        prisma.emailEvent.findMany({
            where: { leadId: id, teamId },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { campaign: { select: { name: true } }, email: { select: { subject: true, status: true } } }
        }),
        prisma.email.findMany({
            where: { leadId: id, campaign: { teamId } },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { campaign: { select: { name: true } } }
        }),
        (prisma as any).leadActivity.findMany({
            where: { leadId: id },
            orderBy: { createdAt: "desc" },
            take: 50
        })
    ]);

    const timeline = [
        ...events.map((event) => ({
            id: `event-${event.id}`,
            type: event.type,
            title: event.type === "SENT" ? "Email sent" : `Email ${event.type.toLowerCase()}`,
            subject: event.email?.subject || undefined,
            status: event.email?.status || undefined,
            campaignName: event.campaign?.name || undefined,
            createdAt: event.createdAt,
            payload: event.payload
        })),
        ...emails.map((email) => ({
            id: `email-${email.id}`,
            type: "EMAIL",
            title: `Email ${email.status}`,
            subject: email.subject,
            status: email.status,
            campaignName: email.campaign?.name || undefined,
            createdAt: email.createdAt
        })),
        ...leadActivities.map((activity: any) => ({
            id: `lead-activity-${activity.id}`,
            type: activity.type,
            title: activity.title,
            status: activity.channel,
            createdAt: activity.createdAt,
            payload: activity.metadata
        }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ timeline });
}
