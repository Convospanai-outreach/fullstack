import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { BrandingConfig, BrandingService } from "@/modules/branding/brandingService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const branding: BrandingConfig = {
        logoUrl: body.logoUrl,
        primaryColor: body.primaryColor,
        portalTitle: body.portalTitle,
        faviconUrl: body.faviconUrl
    };

    await BrandingService.updateBranding(ctx.teamId, branding);
    return NextResponse.json({ success: true });
}
