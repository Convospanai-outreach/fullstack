import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../_lib/auth";

// A short activity line from the copilot extension ("Lead Hunter started", ...), kept with its events.
const FEATURES = new Set(["general", "auto_comment", "lead_hunter", "outreach", "contacts_fetcher", "safety"]);

export async function POST(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    const feature = typeof body?.feature === "string" && FEATURES.has(body.feature) ? body.feature : null;
    const action = typeof body?.action === "string" ? body.action.trim().slice(0, 80) : "";
    if (!feature || !action) return NextResponse.json({ ok: true, ignored: true });
    await prisma.extensionEvent.create({
        data: {
            userId: auth.user.id,
            eventId: `log-${crypto.randomUUID()}`,
            type: "ACTION_LOG",
            feature,
            detail: String(body.detail ?? "").slice(0, 500) || null,
            data: { action },
            occurredAt: new Date()
        }
    });
    return NextResponse.json({ ok: true });
}
