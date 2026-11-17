import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";
import { DRIP_PLAYBOOKS, recommendDripPlaybooks } from "@/modules/playbooks/dripPlaybooks";
import { loadDripContext } from "@/modules/playbooks/dripDraft";

// Drip playbooks ranked by how well they fit this team's website scan and ICP. Read only.
export async function GET(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const { profile, icp, calendarLink } = await loadDripContext(ctx.teamId);
        const ranked = recommendDripPlaybooks(profile, icp);
        const playbooks = ranked.map((r) => {
            const p = DRIP_PLAYBOOKS.find((d) => d.kind === r.kind)!;
            return { ...p, score: r.score, reasons: r.reasons, emails: p.emails.length, schedule: p.emails.map((e) => ({ delayDays: e.delayDays, delayHours: e.delayHours ?? 0, cta: e.cta })) };
        });
        return NextResponse.json({ ok: true, hasProfile: Boolean(profile), hasBookingLink: Boolean(calendarLink), playbooks });
    } catch (err) {
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
