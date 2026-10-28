import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";
import { MAX_STATE_ROWS_PER_USER, MAX_VALUE_CHARS, syncableKey } from "@/services/extensionCopilot/sync";

// The extension's storage mirror. POST sends changes ({ ops }); GET pages through everything stored
// (rows ordered by key, item) so another browser can be restored after sign-in.
// An op: { key, item, value } sets one item ("" = the whole value), { key, item, deleted: true }
// removes it, item "*" with deleted removes the whole key. Older changes never overwrite newer ones.
const PAGE = 500;
const MAX_OPS = 300;

export async function GET(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
    const url = new URL(req.url);
    const afterKey = url.searchParams.get("after_key") || "";
    const afterItem = url.searchParams.get("after_item") || "";
    const rows = await prisma.extensionStateItem.findMany({
        where: {
            userId: auth.user.id,
            deleted: false,
            OR: [{ key: { gt: afterKey } }, { key: afterKey, item: { gt: afterItem } }]
        },
        orderBy: [{ key: "asc" }, { item: "asc" }],
        take: PAGE,
        select: { key: true, item: true, value: true }
    });
    const last = rows[rows.length - 1];
    return NextResponse.json({ rows, next: rows.length === PAGE && last ? { key: last.key, item: last.item } : null });
}

export async function POST(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
    const body = await req.json().catch(() => null);
    const ops: any[] = Array.isArray(body?.ops) ? body.ops : [];
    if (ops.length > MAX_OPS) return NextResponse.json({ error: `At most ${MAX_OPS} ops per request` }, { status: 413 });

    const userId = auth.user.id;
    let room = MAX_STATE_ROWS_PER_USER - (await prisma.extensionStateItem.count({ where: { userId } }));
    let applied = 0, rejected = 0;
    for (const op of ops) {
        const changedAt = new Date(op?.changed_at);
        const item = typeof op?.item === "string" ? op.item.slice(0, 200) : "";
        if (!syncableKey(op?.key) || Number.isNaN(changedAt.getTime())) { rejected++; continue; }
        const key: string = op.key;

        if (op.deleted && item === "*") {
            await prisma.extensionStateItem.updateMany({
                where: { userId, key, changedAt: { lte: changedAt } },
                data: { deleted: true, value: undefined, changedAt }
            });
            applied++;
            continue;
        }
        const value = op.deleted ? null : op.value;
        if (!op.deleted && (value === undefined || JSON.stringify(value).length > MAX_VALUE_CHARS)) { rejected++; continue; }

        const id = { userId_key_item: { userId, key, item } };
        const current = await prisma.extensionStateItem.findUnique({ where: id, select: { changedAt: true } });
        if (current && current.changedAt > changedAt) continue; // a newer change is already stored
        if (!current) {
            if (op.deleted) continue;
            if (room <= 0) { rejected++; continue; }
            room--;
        }
        await prisma.extensionStateItem.upsert({
            where: id,
            create: { userId, key, item, value, deleted: false, changedAt },
            update: { value: op.deleted ? undefined : value, deleted: !!op.deleted, changedAt }
        });
        applied++;
    }
    return NextResponse.json({ ok: true, applied, rejected });
}
