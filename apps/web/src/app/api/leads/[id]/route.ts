import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || id === "undefined" || id === "null") {
            return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
        }

        const lead = await prisma.lead.findFirst({
            where: { id, teamId },
            include: {
                campaign: { select: { id: true, name: true, status: true } },
                emails: { orderBy: { createdAt: "desc" }, take: 10 },
            },
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        return NextResponse.json(lead);
    } catch (error: any) {
        console.error("GET /api/leads/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || id === "undefined" || id === "null") {
            return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
        }

        const body = await request.json();
        const { fullName, email, linkedIn, company, status, campaignId } = body;

        const updated = await prisma.lead.updateMany({
            where: { id, teamId },
            data: {
                ...(fullName !== undefined && { fullName }),
                ...(email !== undefined && { email }),
                ...(linkedIn !== undefined && { linkedIn }),
                ...(company !== undefined && { company }),
                ...(status !== undefined && { status }),
                ...(campaignId !== undefined && { campaignId }),
            },
        });

        if (updated.count === 0) {
            return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
        }

        const lead = await prisma.lead.findUnique({ where: { id } });
        return NextResponse.json(lead);
    } catch (error: any) {
        console.error("PATCH /api/leads/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || id === "undefined" || id === "null") {
            return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
        }

        const deleted = await prisma.lead.deleteMany({
            where: { id, teamId },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/leads/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
