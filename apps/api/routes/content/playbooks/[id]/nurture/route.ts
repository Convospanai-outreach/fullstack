import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";
import { nurtureSwitchSchema } from "@/modules/creator-funnel/playbookSwitches";

// Switches a launch plan's nurture emails on or off. Switching on starts automatic sends to new
// sign-ups, so it needs an admin, like a product's automations.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        if (!(await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const parsed = await parseBody(req, nurtureSwitchSchema);
        if (!parsed.ok) return parsed.response;
        const { id } = await params;
        const { setPlanNurture } = await import("@/modules/creator-funnel/playbookSwitches");
        return NextResponse.json(await setPlanNurture(ctx.teamId, ctx.userId, id, parsed.data));
    } catch (error) {
        return contentError(error);
    }
}
