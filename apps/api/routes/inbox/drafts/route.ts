import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InboxService } from "@/lib/inboxService";

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { leadId, content } = body;

        if (!leadId || !content) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const senderName = user?.name || "Agent";
        const draft = await InboxService.saveDraft(leadId, content, senderName, teamId);

        return NextResponse.json({ draft });

    } catch (error: any) {
        if (error.message === "LEAD_NOT_FOUND") {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        console.error("Error saving draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const draftId = searchParams.get("draftId");

        if (!draftId) {
            return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
        }

        await InboxService.discardDraft(draftId, teamId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error.message === "DRAFT_NOT_FOUND") {
            return NextResponse.json({ error: "Draft not found" }, { status: 404 });
        }
        console.error("Error discarding draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
