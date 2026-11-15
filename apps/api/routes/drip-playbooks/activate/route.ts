import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";
import { dripOf } from "@/modules/playbooks/dripTriggers";

const bodySchema = z.object({
    campaignId: z.string().trim().min(1).max(100),
    active: z.boolean(),
    landingPageId: z.string().trim().min(1).max(100).optional(),
    linkUrl: z.string().trim().max(500).optional(),
});

const httpUrl = (value?: string) => {
    try {
        const url = new URL(value ?? "");
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
};

// Switches a drafted drip playbook on or off, and says which landing page or link starts it.
// Switching on does not email anyone who is already a contact, except win-back (a few a day).
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const body = bodySchema.safeParse(await req.json().catch(() => null));
        if (!body.success) return NextResponse.json({ error: "Choose a playbook" }, { status: 400 });
        const { campaignId, active, landingPageId, linkUrl } = body.data;

        const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId: ctx.teamId }, select: { aiConfig: true } });
        const drip = dripOf(campaign?.aiConfig);
        if (!campaign || !drip) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

        let rule: NonNullable<typeof drip.rule> = {};
        if (active) {
            if (drip.trigger === "manual") return NextResponse.json({ error: "This playbook starts when you add a lead to it" }, { status: 400 });
            const steps = await prisma.sequenceStep.count({ where: { teamId: ctx.teamId, sequence: { campaignId }, status: "ACTIVE" } });
            if (!steps) return NextResponse.json({ error: "This playbook has no emails" }, { status: 400 });
            if (drip.trigger === "landing_signup") {
                const page = landingPageId ? await prisma.landingPage.findFirst({ where: { id: landingPageId, teamId: ctx.teamId }, select: { id: true } }) : null;
                if (!page) return NextResponse.json({ error: "Choose one of your landing pages" }, { status: 400 });
                rule = { landingPageId: page.id };
            } else if (drip.trigger === "link_click") {
                const url = httpUrl(linkUrl);
                if (!url) return NextResponse.json({ error: "Enter the link (for example your brochure) that starts this follow-up" }, { status: 400 });
                rule = { url };
            }
        }

        const config = campaign.aiConfig as Record<string, unknown>;
        const next = { ...drip, active, rule: active ? rule : drip.rule, ...(active ? { cursor: new Date().toISOString() } : {}) };
        await prisma.campaign.updateMany({ where: { id: campaignId, teamId: ctx.teamId }, data: { aiConfig: { ...config, dripPlaybook: next } as object } });
        return NextResponse.json({ ok: true, active });
    } catch (err) {
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
