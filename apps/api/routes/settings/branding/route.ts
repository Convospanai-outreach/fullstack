import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { BrandingConfig, BrandingService } from "@/modules/branding/brandingService";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

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

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();

    if (body.logoUrl && !isValidHttpUrl(body.logoUrl)) {
        return NextResponse.json({ error: "Invalid logoUrl: must use http or https protocol" }, { status: 400 });
    }
    if (body.faviconUrl && !isValidHttpUrl(body.faviconUrl)) {
        return NextResponse.json({ error: "Invalid faviconUrl: must use http or https protocol" }, { status: 400 });
    }
    if (body.primaryColor && !isValidColor(body.primaryColor)) {
        return NextResponse.json({ error: "Invalid primaryColor format: must be valid hex or rgb color" }, { status: 400 });
    }

    const sanitizedTitle = sanitizeText(body.portalTitle);

    const branding: BrandingConfig = {
        logoUrl: body.logoUrl,
        primaryColor: body.primaryColor,
        portalTitle: sanitizedTitle,
        faviconUrl: body.faviconUrl
    };

    await BrandingService.updateBranding(ctx.teamId, branding);
    return NextResponse.json({ success: true });
}
