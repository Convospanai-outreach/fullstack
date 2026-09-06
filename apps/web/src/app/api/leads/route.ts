import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createLeadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, code: string) {
    return NextResponse.json({ error: message, code }, { status });
}

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return jsonError("Unauthorized", 401, "UNAUTHORIZED");

        const { prisma } = await import("@/lib/db");
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim() || "";
        const status = searchParams.get("status")?.trim() || "";
        const channelFilter = searchParams.get("channelFilter")?.trim() || "";
        const limit = Math.min(Number.parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
        const offset = Number.parseInt(searchParams.get("offset") || "0", 10) || 0;

        const where: any = { teamId };
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status) where.status = status;
        if (channelFilter === "linkedin_captured_not_contacted") {
            where.channelStatuses = { some: { channel: "LINKEDIN", status: { in: ["CAPTURED", "DRAFTED"] } } };
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { updatedAt: "desc" },
                include: { channelStatuses: true },
            }),
            prisma.lead.count({ where }),
        ]);

        return NextResponse.json({ leads, total });
    } catch (error) {
        console.error("[api:leads:get]", error);
        return jsonError("Lead list is temporarily unavailable.", 503, "LEADS_QUERY_FAILED");
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return jsonError("Unauthorized", 401, "UNAUTHORIZED");

        const body = await req.json();
        const validation = createLeadSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                error: "Invalid lead input",
                code: "VALIDATION_ERROR",
                issues: validation.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
            }, { status: 400 });
        }

        const { prisma } = await import("@/lib/db");
        const data = validation.data;
        if (!data.email && !data.linkedIn) {
            return jsonError("Either email or LinkedIn URL is required.", 400, "VALIDATION_ERROR");
        }

        const existing = await prisma.lead.findFirst({
            where: {
                teamId,
                OR: [
                    ...(data.email ? [{ email: data.email }] : []),
                    ...(data.linkedIn ? [{ linkedIn: data.linkedIn }] : []),
                ],
            },
        });

        // campaignId is caller-supplied - verify it actually belongs to this team
        // before linking any lead to it, or a caller could attach their leads to
        // (and pollute the stats/leadList of) another tenant's campaign.
        let campaignId = data.campaignId ?? null;
        if (campaignId) {
            const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId }, select: { id: true } });
            if (!campaign) campaignId = null;
        }

        const leadData: any = {
            fullName: data.fullName ?? existing?.fullName ?? null,
            email: data.email ?? existing?.email ?? null,
            linkedIn: data.linkedIn ?? existing?.linkedIn ?? null,
            phone: data.phone ?? existing?.phone ?? null,
            company: data.company ?? existing?.company ?? null,
            jobTitle: data.jobTitle ?? existing?.jobTitle ?? null,
            location: data.location ?? existing?.location ?? null,
            status: data.status || existing?.status || "NEW",
            pipelineState: data.pipelineState || existing?.pipelineState || "COLD",
            tags: data.tags || existing?.tags || [],
            crmId: data.crmId ?? existing?.crmId ?? null,
            value: data.value ?? existing?.value ?? 0,
            campaignId: campaignId ?? existing?.campaignId ?? null,
            teamId,
            updatedAt: new Date(),
        };

        const lead = existing
            ? await prisma.lead.update({ where: { id: existing.id }, data: leadData })
            : await prisma.lead.create({ data: leadData });

        return NextResponse.json(lead, { status: existing ? 200 : 201 });
    } catch (error) {
        console.error("[api:leads:post]", error);
        return jsonError("Lead could not be saved.", 503, "LEAD_SAVE_FAILED");
    }
}
