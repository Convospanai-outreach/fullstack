import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { BrandingService, CustomDomainsUnavailableError } from "@/modules/branding/brandingService";
import { getCnameTarget } from "@/modules/branding/cloudflareCustomHostnameService";

export const dynamic = "force-dynamic";

// Exact hostnames only for v1 - no leading/trailing dots, no wildcard, no scheme.
const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
// Our own domains (app, api, pages host) can never be a team's landing domain.
const OWN_DOMAIN_PATTERN = /(^|\.)craftmyfunnel\.(live|com)$/;

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ domains: [] });
        }

        const { prisma } = await import("@/lib/db");
        const [domains, pages] = await Promise.all([
            prisma.customDomain.findMany({
                where: { teamId },
                select: { id: true, domain: true, status: true, homeSlug: true, ownershipVerificationName: true, ownershipVerificationValue: true, createdAt: true },
                orderBy: { createdAt: "desc" },
            }),
            // The published pages a domain's home page can be picked from.
            prisma.landingPage.findMany({
                where: { teamId, status: "published" },
                select: { slug: true, title: true },
                orderBy: { updatedAt: "desc" },
                take: 200,
            }),
        ]);
        return NextResponse.json({ domains, pages, cnameTarget: getCnameTarget() });
    } catch (error) {
        console.error("[settings:branding:domains:get]", error);
        return NextResponse.json({ domains: [], degraded: true });
    }
}

async function requireAdmin() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
    }

    const { checkTeamPermission, TeamRole } = await import("@/lib/permissions");
    const isAdmin = await checkTeamPermission(userId, teamId, TeamRole.ADMIN);
    if (!isAdmin) {
        return { error: NextResponse.json({ ok: false, error: "Forbidden: Admin permissions required" }, { status: 403 }) };
    }
    return { teamId };
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("error" in auth) return auth.error;

        const body = await req.json().catch(() => ({}));
        const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase() : "";
        if (!domain || !HOSTNAME_PATTERN.test(domain) || OWN_DOMAIN_PATTERN.test(domain)) {
            return NextResponse.json({ ok: false, error: "Enter a valid domain, e.g. go.yourdomain.com" }, { status: 400 });
        }

        const { prisma } = await import("@/lib/db");
        const existing = await prisma.customDomain.findUnique({ where: { domain } });
        if (existing) {
            return NextResponse.json({ ok: false, error: "This domain is already connected." }, { status: 409 });
        }

        const created = await BrandingService.addDomain(auth.teamId, domain);

        return NextResponse.json({ ok: true, domain: created });
    } catch (error) {
        if (error instanceof CustomDomainsUnavailableError) {
            return NextResponse.json({ ok: false, error: "Custom domains aren't switched on yet." }, { status: 503 });
        }
        console.error("[settings:branding:domains:post]", error);
        return NextResponse.json({ ok: false, error: "Unable to connect domain right now." }, { status: 500 });
    }
}

// Sets the page shown at a domain's root: { id, homeSlug } (homeSlug null clears it).
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("error" in auth) return auth.error;

        const body = await req.json().catch(() => ({}));
        const id = typeof body?.id === "string" ? body.id : "";
        const homeSlug = typeof body?.homeSlug === "string" && body.homeSlug ? body.homeSlug : null;
        if (!id) {
            return NextResponse.json({ ok: false, error: "Missing domain id" }, { status: 400 });
        }

        const saved = await BrandingService.setHomePage(auth.teamId, id, homeSlug);
        if (!saved) {
            return NextResponse.json({ ok: false, error: "Domain or published page not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[settings:branding:domains:patch]", error);
        return NextResponse.json({ ok: false, error: "Unable to set the home page right now." }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("error" in auth) return auth.error;

        const id = new URL(req.url).searchParams.get("id");
        if (!id) {
            return NextResponse.json({ ok: false, error: "Missing domain id" }, { status: 400 });
        }

        const removed = await BrandingService.removeDomain(auth.teamId, id);
        if (!removed) {
            return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[settings:branding:domains:delete]", error);
        return NextResponse.json({ ok: false, error: "Unable to remove domain right now." }, { status: 500 });
    }
}
