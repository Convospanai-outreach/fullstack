import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const integrations = await prisma.crmIntegration.findMany({
            where: { teamId }
        });
        return NextResponse.json(integrations);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { provider, accessToken, refreshToken, expiresAt, isActive, fieldMapping, syncSettings } = body;

        const updateData: any = {
            accessToken,
            refreshToken,
            isActive,
            fieldMapping,
            syncSettings
        };
        if (expiresAt) {
            updateData.expiresAt = new Date(expiresAt);
        }

        const createData: any = {
            teamId,
            provider,
            accessToken,
            refreshToken,
            isActive,
            fieldMapping,
            syncSettings
        };
        if (expiresAt) {
            createData.expiresAt = new Date(expiresAt);
        }

        const integration = await prisma.crmIntegration.upsert({
            where: { teamId_provider: { teamId, provider } },
            update: updateData,
            create: createData
        });

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "UPDATE_CRM_CONFIG",
            entity: "CrmIntegration",
            entityId: integration.id,
            metadata: { provider, isActive }
        });

        return NextResponse.json(integration);
    } catch (error: any) {
        console.error("[CRM API] PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { leadId } = await req.json();
        const { crmService } = await import("@/modules/crm-integration/service/crmService");

        const result = await crmService.syncLead(leadId, teamId);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
