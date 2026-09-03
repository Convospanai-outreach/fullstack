import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { encryptCrmToken } from "@/modules/crm-integration/service/crmSecrets";

function sanitizeCrmIntegration(integration: any) {
    const { accessToken, refreshToken, ...safeIntegration } = integration;
    return {
        ...safeIntegration,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken)
    };
}

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const integrations = await prisma.crmIntegration.findMany({
            where: { teamId }
        });
        return NextResponse.json(integrations.map(sanitizeCrmIntegration));
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { provider, accessToken, refreshToken, expiresAt, isActive, fieldMapping, syncSettings } = body;

        // Only HUBSPOT is currently implemented. Salesforce/Pipedrive are "Coming Soon"
        // in the UI — reject them at the API level too so a direct PUT can't create a
        // record that shows "Connected" with no backing sync logic.
        const ALLOWED_PROVIDERS = ["HUBSPOT"] as const;
        if (!provider || !ALLOWED_PROVIDERS.includes(provider as typeof ALLOWED_PROVIDERS[number])) {
            return NextResponse.json(
                { error: `Unsupported CRM provider. Allowed: ${ALLOWED_PROVIDERS.join(", ")}` },
                { status: 400 }
            );
        }

        // GET never returns the real tokens (sanitizeCrmIntegration strips them), so
        // any non-empty value here is a genuinely new token from the OAuth exchange
        // or a manual paste - never a round-tripped placeholder.
        const encryptedAccessToken = accessToken ? encryptCrmToken(accessToken) : accessToken;
        const encryptedRefreshToken = refreshToken ? encryptCrmToken(refreshToken) : refreshToken;

        const updateData: any = {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
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
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
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

        return NextResponse.json(sanitizeCrmIntegration(integration));
    } catch (error: any) {
        console.error("[CRM API] PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { leadId } = await req.json();
        const { crmService } = await import("@/modules/crm-integration/service/crmService");

        const result = await crmService.syncLead(leadId, teamId);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
