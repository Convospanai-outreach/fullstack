import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

function decodePubSubData(data: string | undefined) {
    if (!data) return {};
    try {
        return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    } catch {
        return {};
    }
}

export async function POST(req: NextRequest) {
    const expectedToken = process.env["GMAIL_PUBSUB_WEBHOOK_TOKEN"];
    if (!expectedToken && process.env["NODE_ENV"] === "production") {
        return NextResponse.json({ error: "Gmail Pub/Sub webhook token is not configured" }, { status: 503 });
    }
    if (expectedToken) {
        const provided = req.headers.get("x-gmail-webhook-token") || new URL(req.url).searchParams.get("token");
        if (provided !== expectedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const body = await req.json().catch(() => ({}));
    const payload = decodePubSubData(body?.message?.data);
    const emailAddress = typeof payload.emailAddress === "string" ? payload.emailAddress : null;
    const historyId = typeof payload.historyId === "string" ? payload.historyId : null;

    if (!emailAddress) {
        return NextResponse.json({ ok: true, ignored: true });
    }

    const mailboxes = await (prisma as any).connectedMailbox.findMany({
        where: { emailAddress, provider: "GOOGLE", status: "ACTIVE" },
        select: { id: true, teamId: true },
    });

    for (const mailbox of mailboxes) {
        await JobQueue.enqueue(
            "GMAIL_SYNC",
            { mailboxId: mailbox.id, historyId },
            {
                teamId: mailbox.teamId,
                priority: 5,
                idempotencyKey: historyId ? `gmail_sync_${mailbox.id}_${historyId}` : undefined,
            }
        );
    }

    return NextResponse.json({ ok: true, queued: mailboxes.length });
}
