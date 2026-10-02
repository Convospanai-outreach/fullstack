import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";
import { updateAutomationSchema } from "@/modules/creator-funnel/productAutomationService";

// A product's creator funnel automations: delivery email after payment and the cart-abandon
// sequence (404 while the creator-funnel flag is off). Changing them needs an admin, like
// editing the product itself.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "read");
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const { getAutomation } = await import("@/modules/creator-funnel/productAutomationService");
        return NextResponse.json(await getAutomation(ctx.teamId, id));
    } catch (error) {
        return contentError(error);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        if (!(await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const parsed = await parseBody(req, updateAutomationSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { updateAutomation } = await import("@/modules/creator-funnel/productAutomationService");
        return NextResponse.json({ automation: await updateAutomation(ctx.teamId, ctx.userId, id, parsed.data) });
    } catch (error) {
        return contentError(error);
    }
}
