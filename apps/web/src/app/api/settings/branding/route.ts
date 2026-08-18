import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({
                ok: false,
                gated: true,
                message: "Branding customization is not available until a workspace is active.",
            });
        }

        const body = await req.json().catch(() => ({}));
        const { logoUrl, primaryColor, portalTitle } = body || {};

        const { prisma } = await import("@/lib/db");
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { branding: true },
        });
        const currentBranding = (team?.branding as Record<string, unknown> | null) || {};

        const updatedBranding = {
            ...currentBranding,
            logoUrl: logoUrl ?? currentBranding["logoUrl"],
            primaryColor: primaryColor ?? currentBranding["primaryColor"],
            portalTitle: portalTitle ?? currentBranding["portalTitle"],
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
