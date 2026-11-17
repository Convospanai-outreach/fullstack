import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";
import { cleanEvent, type CleanEvent } from "@/services/extensionCopilot/sync";

// The extension's outbox: business events (invite sent, comment posted, ...) in batches. Each one is
// answered ok / duplicate / rejected, so the extension can drop it from its outbox.
const MAX_EVENTS = 100;

export async function POST(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const events: unknown[] = Array.isArray(body?.events) ? body.events : [];
    if (!events.length) return NextResponse.json({ error: "No events" }, { status: 400 });
    if (events.length > MAX_EVENTS) return NextResponse.json({ error: `At most ${MAX_EVENTS} events per request` }, { status: 413 });

    const userId = auth.user.id;
    const results: Array<{ event_id: string; status: "ok" | "duplicate" | "rejected"; error?: string }> = [];
    const valid: CleanEvent[] = [];
    for (const raw of events) {
        const ev = cleanEvent(raw);
        const id = String((raw as any)?.event_id ?? "").slice(0, 120);
        if ("error" in ev) results.push({ event_id: id, status: "rejected", error: ev.error });
        else valid.push(ev);
    }

    const ids = valid.map((v) => v.eventId);
    const existing = new Set(
        ids.length
            ? (await prisma.extensionEvent.findMany({ where: { userId, eventId: { in: ids } }, select: { eventId: true } })).map((r) => r.eventId)
            : []
    );
    const fresh = valid.filter((v, i) => !existing.has(v.eventId) && ids.indexOf(v.eventId) === i);
    if (fresh.length) {
        await prisma.extensionEvent.createMany({
            data: fresh.map((v) => ({ userId, eventId: v.eventId, type: v.type, feature: v.feature, detail: v.detail || null, data: v.data, occurredAt: v.occurredAt })),
            skipDuplicates: true
        });
    }
    // Stored now = ok; already stored, or a repeat of an id earlier in this batch = duplicate.
    const freshSet = new Set(fresh);
    for (const v of valid) results.push({ event_id: v.eventId, status: freshSet.has(v) ? "ok" : "duplicate" });
    return NextResponse.json({ results });
}
