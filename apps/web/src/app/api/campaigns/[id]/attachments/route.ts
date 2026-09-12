import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PDF/PPT only, matching what the ask was for; keep the allowlist tight rather
// than accepting arbitrary file types through an email-attachment endpoint.
const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
]);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB — generous for a PDF/PPT, keeps sends fast

async function getCampaignForTeam(id: string, requiredRole: TeamRole) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        throw new Error("Unauthorized");
    }
    await authorizeRole(userId, teamId, requiredRole);
    const { prisma } = await import("@/lib/db");

    const campaign = await prisma.campaign.findFirst({ where: { id, teamId } });
    if (!campaign) {
        throw new Error("Campaign not found");
    }
    return { prisma, teamId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { prisma } = await getCampaignForTeam(id, TeamRole.VIEWER);

        const attachments = await prisma.campaignAttachment.findMany({
            where: { campaignId: id },
            select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ attachments });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { prisma } = await getCampaignForTeam(id, TeamRole.MEMBER);

        const body = await req.json();
        const { filename, mimeType, content } = body || {};

        if (typeof filename !== "string" || !filename.trim()) {
            return NextResponse.json({ error: "filename is required" }, { status: 400 });
        }
        if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
            return NextResponse.json({ error: "Only PDF or PowerPoint files are allowed" }, { status: 400 });
        }
        if (typeof content !== "string" || !content) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const sizeBytes = Math.floor((content.length * 3) / 4);
        if (sizeBytes > MAX_ATTACHMENT_BYTES) {
            return NextResponse.json({ error: "Attachment must be 10MB or smaller" }, { status: 400 });
        }

        const attachment = await prisma.campaignAttachment.create({
            data: { campaignId: id, filename: filename.trim(), mimeType, sizeBytes, content },
            select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
        });

        return NextResponse.json({ attachment }, { status: 201 });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { prisma } = await getCampaignForTeam(id, TeamRole.MEMBER);

        const { searchParams } = new URL(req.url);
        const attachmentId = searchParams.get("attachmentId");
        if (!attachmentId) {
            return NextResponse.json({ error: "attachmentId is required" }, { status: 400 });
        }

        await prisma.campaignAttachment.deleteMany({ where: { id: attachmentId, campaignId: id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}
