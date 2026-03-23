import { NextResponse } from "next/server";
import { CampaignService } from "@/lib/campaignService";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const stats = await CampaignService.getCampaignStats(id);
        const campaign = await prisma.campaign.findUnique({ where: { id } });
        return NextResponse.json({ ...campaign, stats });
    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (body.action === "start") {
            await CampaignService.startCampaign(id);
        } else if (body.action === "pause") {
            await CampaignService.pauseCampaign(id);
        } else if (body.leadIds) {
            await CampaignService.addLeadsToCampaign(id, body.leadIds);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.campaign.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
