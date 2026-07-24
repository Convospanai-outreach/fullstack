import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VariantSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Body is required"),
    weight: z.number().min(0).max(100).default(50),
});

const VariantsArraySchema = z.array(VariantSchema);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");
        const { id: campaignId } = await params;
        const body = await req.json();

        const validation = VariantsArraySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId }
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        await prisma.campaignVariant.deleteMany({
            where: { campaignId }
        });

        const variants = await Promise.all(
            validation.data.map(v =>
                prisma.campaignVariant.create({
                    data: {
                        campaignId,
                        subject: v.subject,
                        body: v.body,
                        weight: v.weight
                    }
                })
            )
        );

        return NextResponse.json({ success: true, variants }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");
        const { id: campaignId } = await params;

        const variants = await prisma.campaignVariant.findMany({
            where: { campaignId, campaign: { teamId } }
        });

        return NextResponse.json({ success: true, variants });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
