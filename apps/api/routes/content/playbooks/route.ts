import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext, playbookWizardSchema } from "@/modules/creator-funnel/contentRoutes";

// Creator funnel playbook wizard: the team's plans (plus the products and audiences the wizard
// offers), and starting a new one. Writing the posts runs in a job; the page polls the plan.
export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req);
        if (ctx instanceof NextResponse) return ctx;
        const [{ listRuns }, { prisma }] = await Promise.all([import("@/modules/creator-funnel/playbookWizard"), import("@/lib/db")]);
        const [runs, products, icps] = await Promise.all([
            listRuns(ctx.teamId),
            prisma.product.findMany({
                where: { teamId: ctx.teamId, isActive: true },
                select: { id: true, name: true, priceAmount: true, currency: true },
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            prisma.iCP.findMany({ where: { teamId: ctx.teamId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 100 }),
        ]);
        return NextResponse.json({ runs, products, icps });
    } catch (error) {
        return contentError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const parsed = await parseBody(req, playbookWizardSchema);
        if (!parsed.ok) return parsed.response;
        const { startRun } = await import("@/modules/creator-funnel/playbookWizard");
        const run = await startRun(ctx.teamId, ctx.userId, parsed.data);
        return NextResponse.json({ run: { id: run.id, status: run.status } }, { status: 202 });
    } catch (error) {
        return contentError(error);
    }
}
