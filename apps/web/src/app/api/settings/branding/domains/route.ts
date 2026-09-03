import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { BrandingService } from "@/modules/branding/brandingService";

export const dynamic = "force-dynamic";

// Exact hostnames only for v1 - no leading/trailing dots, no wildcard, no scheme.
const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ domains: [] });
        }

        const { prisma } = await import("@/lib/db");
        const domains = await prisma.customDomain.findMany({
            where: { teamId },
            select: { id: true, domain: true, status: true, ownershipVerificationName: true, ownershipVerificationValue: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ domains });
    } catch (error) {
        console.error("[settings:branding:domains:get]", error);
        return NextResponse.json({ domains: [], degraded: true });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { checkTeamPermission, TeamRole } = await import("@/lib/permissions");
        const isAdmin = await checkTeamPermission(userId, teamId, TeamRole.ADMIN);
        if (!isAdmin) {
            return NextResponse.json({ ok: false, error: "Forbidden: Admin permissions required" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase() : "";
        if (!domain || !HOSTNAME_PATTERN.test(domain)) {
            return NextResponse.json({ ok: false, error: "Enter a valid domain, e.g. go.yourdomain.com" }, { status: 400 });
        }

        const { prisma } = await import("@/lib/db");
        const existing = await prisma.customDomain.findUnique({ where: { domain } });
        if (existing) {
            return NextResponse.json({ ok: false, error: "This domain is already connected." }, { status: 409 });
        }

        const created = await BrandingService.addDomain(teamId, domain);

        return NextResponse.json({ ok: true, domain: created });
    } catch (error) {
        console.error("[settings:branding:domains:post]", error);
        return NextResponse.json({ ok: false, error: "Unable to connect domain right now." }, { status: 500 });
    }
}
