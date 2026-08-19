import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isValidHttpUrl(urlString: unknown): boolean {
    if (!urlString || typeof urlString !== "string") return true;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function isValidColor(colorString: unknown): boolean {
    if (!colorString || typeof colorString !== "string") return true;
    return (
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(colorString) ||
        /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(colorString) ||
        /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i.test(colorString)
    );
}

function sanitizeText(text: unknown, maxLength = 100): string | undefined {
    if (text === undefined || text === null) return undefined;
    if (typeof text !== "string") return "";
    return text.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ branding: null });
        }

        const { prisma } = await import("@/lib/db");
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { branding: true },
        });

        const branding = (team?.branding as Record<string, unknown> | null) || null;
        return NextResponse.json({ branding });
    } catch (error) {
        console.error("[settings:branding:get]", error);
        return NextResponse.json({ branding: null, degraded: true });
    }
}

export async function POST(req: Request | NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({
                ok: false,
                gated: true,
                message: "Branding customization is not available until a workspace is active.",
            });
        }

        const { checkTeamPermission, TeamRole } = await import("@/lib/permissions");
        const isAdmin = await checkTeamPermission(userId, teamId, TeamRole.ADMIN);
        if (!isAdmin) {
            return NextResponse.json({ ok: false, error: "Forbidden: Admin permissions required to modify branding" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const { logoUrl, primaryColor, portalTitle, faviconUrl } = body || {};

        if (logoUrl && !isValidHttpUrl(logoUrl)) {
            return NextResponse.json({ ok: false, error: "Invalid logoUrl: must use http or https protocol" }, { status: 400 });
        }
        if (faviconUrl && !isValidHttpUrl(faviconUrl)) {
            return NextResponse.json({ ok: false, error: "Invalid faviconUrl: must use http or https protocol" }, { status: 400 });
        }
        if (primaryColor && !isValidColor(primaryColor)) {
            return NextResponse.json({ ok: false, error: "Invalid primaryColor format: must be valid hex or rgb color" }, { status: 400 });
        }

        const sanitizedTitle = sanitizeText(portalTitle);

        const { prisma } = await import("@/lib/db");
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { branding: true },
        });
        const currentBranding = (team?.branding as Record<string, unknown> | null) || {};

        const updatedBranding = {
            ...currentBranding,
            logoUrl: logoUrl !== undefined ? logoUrl : currentBranding["logoUrl"],
            faviconUrl: faviconUrl !== undefined ? faviconUrl : currentBranding["faviconUrl"],
            primaryColor: primaryColor !== undefined ? primaryColor : currentBranding["primaryColor"],
            portalTitle: sanitizedTitle !== undefined ? sanitizedTitle : currentBranding["portalTitle"],
        };

        await prisma.team.update({
            where: { id: teamId },
            data: { branding: updatedBranding },
        });

        return NextResponse.json({ ok: true, branding: updatedBranding });
    } catch (error) {
        console.error("[settings:branding:post]", error);
        return NextResponse.json({
            ok: false,
            degraded: true,
            message: "Branding settings are temporarily unavailable.",
        });
    }
}
