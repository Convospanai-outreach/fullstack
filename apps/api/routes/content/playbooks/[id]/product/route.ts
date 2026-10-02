import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";
import { useOnProductSchema } from "@/modules/creator-funnel/playbookSwitches";

// Points the plan's product at its checkout reminder and after-purchase sequences (only empty
// fields of a product that's switched off; sends start when the product is switched on).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        if (!(await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const parsed = await parseBody(req, useOnProductSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { useOnProduct } = await import("@/modules/creator-funnel/playbookSwitches");
        return NextResponse.json(await useOnProduct(ctx.teamId, id, parsed.data));
    } catch (error) {
        return contentError(error);
    }
}
