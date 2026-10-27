import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB — generous for a PDF/PPT, keeps sends fast

// These files go to leads from the team's own mailbox, so the browser's claimed type is not
// enough: the filename extension and the bytes must both match it.
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const isPdf = (bytes: Buffer) => bytes.subarray(0, 5).equals(Buffer.from("%PDF-"));
// Legacy .ppt/.pps: an OLE container holding a "PowerPoint Document" stream.
const isLegacyPowerPoint = (bytes: Buffer) =>
    bytes.subarray(0, 8).equals(OLE_SIGNATURE) && bytes.includes(Buffer.from("PowerPoint Document", "utf16le"));
// .pptx/.ppsx: a zip whose entries include the presentation part.
const isOpenXmlPowerPoint = (bytes: Buffer) =>
    bytes.subarray(0, 4).equals(ZIP_SIGNATURE) && bytes.includes(Buffer.from("ppt/presentation.xml"));

// PDF/PPT only, matching what the ask was for; keep the allowlist tight rather
// than accepting arbitrary file types through an email-attachment endpoint.
const FILE_RULES: Record<string, { extensions: string[]; matches: (bytes: Buffer) => boolean }> = {
    "application/pdf": { extensions: [".pdf"], matches: isPdf },
    "application/vnd.ms-powerpoint": { extensions: [".ppt", ".pps"], matches: isLegacyPowerPoint },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extensions: [".pptx"], matches: isOpenXmlPowerPoint },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow": { extensions: [".ppsx"], matches: isOpenXmlPowerPoint },
};

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
        if (typeof mimeType !== "string" || !Object.hasOwn(FILE_RULES, mimeType)) {
            return NextResponse.json({ error: "Only PDF or PowerPoint files are allowed" }, { status: 400 });
        }
        if (typeof content !== "string" || !content) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }
        // Plain base64 only: the stored string is written into the email's MIME body as is.
        if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
            return NextResponse.json({ error: "content must be base64" }, { status: 400 });
        }
        if (content.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) {
            return NextResponse.json({ error: "Attachment must be 10MB or smaller" }, { status: 400 });
        }

        const bytes = Buffer.from(content, "base64");
        const sizeBytes = bytes.length;
        if (sizeBytes > MAX_ATTACHMENT_BYTES) {
            return NextResponse.json({ error: "Attachment must be 10MB or smaller" }, { status: 400 });
        }
        const rule = FILE_RULES[mimeType]!;
        if (!rule.extensions.some((extension) => filename.trim().toLowerCase().endsWith(extension))) {
            return NextResponse.json({ error: `The file name must end in ${rule.extensions.join(" or ")}` }, { status: 400 });
        }
        if (!rule.matches(bytes)) {
            return NextResponse.json({ error: "The file's contents do not match its type" }, { status: 400 });
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
