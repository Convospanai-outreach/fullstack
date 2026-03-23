import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { Permission, authorizePermission } from "@/lib/permissions";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await authorizePermission(userId, teamId, Permission.MANAGE_SSO);

        const ssoConfig = await prisma.ssoConfiguration.findUnique({
            where: { teamId }
        });

        return NextResponse.json(ssoConfig || {});
    } catch (error: any) {
        console.error("[SSO API] GET error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await authorizePermission(userId, teamId, Permission.MANAGE_SSO);

        const body = await req.json();
        const {
            providerType,
            metadataUrl,
            issuer,
            entryPoint,
            certificate,
            clientId,
            clientSecret,
            wellKnownUrl,
            enforced,
            allowedDomains
        } = body;

        const ssoConfig = await prisma.ssoConfiguration.upsert({
            where: { teamId },
            update: {
                providerType,
                metadataUrl,
                issuer,
                entryPoint,
                certificate,
                clientId,
                clientSecret,
                wellKnownUrl,
                enforced,
                allowedDomains
            },
            create: {
                teamId,
                providerType,
                metadataUrl,
                issuer,
                entryPoint,
                certificate,
                clientId,
                clientSecret,
                wellKnownUrl,
                enforced,
                allowedDomains
            }
        });

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "UPDATE_SSO_CONFIG",
            entity: "SsoConfiguration",
            entityId: ssoConfig.id,
            metadata: { providerType, enforced, allowedDomains }
        });

        return NextResponse.json(ssoConfig);
    } catch (error: any) {
        console.error("[SSO API] PUT error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await authorizePermission(userId, teamId, Permission.MANAGE_SSO);

        await prisma.ssoConfiguration.delete({
            where: { teamId }
        });

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "DELETE_SSO_CONFIG",
            entity: "SsoConfiguration",
            entityId: teamId
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[SSO API] DELETE error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
