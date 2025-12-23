import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { leadId, content } = body;

        if (!leadId || !content) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const senderName = session.user.name || "Agent";
        const draft = await InboxService.saveDraft(leadId, content, senderName);

        return NextResponse.json({ draft });

    } catch (error: any) {
        console.error("Error saving draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const draftId = searchParams.get("draftId");

        if (!draftId) {
            return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
        }

        await InboxService.discardDraft(draftId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error discarding draft:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
