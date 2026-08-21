import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sanitizeAddress(text: unknown, maxLength = 500): string | undefined {
    if (text === undefined || text === null) return undefined;
    if (typeof text !== "string") return "";
    return text.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ mailingAddress: null });
        }

        const { prisma } = await import("@/lib/db");
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { mailingAddress: true },
        });

        return NextResponse.json({ mailingAddress: team?.mailingAddress || null });
    } catch (error) {
        console.error("[settings:compliance:get]", error);
        return NextResponse.json({ mailingAddress: null, degraded: true });
    }
}

export async function POST(req: Request | NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({
                ok: false,
                gated: true,
                message: "Compliance settings are not available until a workspace is active.",
            });
        }

        const { checkTeamPermission, TeamRole } = await import("@/lib/permissions");
        const isAdmin = await checkTeamPermission(userId, teamId, TeamRole.ADMIN);
        if (!isAdmin) {
            return NextResponse.json({ ok: false, error: "Forbidden: Admin permissions required to modify compliance settings" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const mailingAddress = sanitizeAddress(body?.mailingAddress);

        const { prisma } = await import("@/lib/db");
        await prisma.team.update({
            where: { id: teamId },
            data: { mailingAddress: mailingAddress || null },
        });

        return NextResponse.json({ ok: true, mailingAddress: mailingAddress || null });
    } catch (error) {
        console.error("[settings:compliance:post]", error);
        return NextResponse.json({
            ok: false,
            degraded: true,
            message: "Compliance settings are temporarily unavailable.",
        });
    }
}
