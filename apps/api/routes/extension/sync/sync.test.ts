import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, db } = vi.hoisted(() => ({
    mockAuth: vi.fn(),
    db: {
        extensionEvent: { findMany: vi.fn(), createMany: vi.fn() },
        extensionStateItem: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), count: vi.fn() }
    }
}));

vi.mock("../_lib/auth", () => ({ validateExtensionAuth: mockAuth }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { POST as postEvents } from "./events/route";
import { GET as getState, POST as postState } from "./state/route";

const post = (url: string, body: unknown) =>
    new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as any;
const ev = (id: string, extra: Record<string, unknown> = {}) =>
    ({ event_id: id, type: "INVITE_SENT", feature: "outreach", occurred_at: new Date().toISOString(), data: { a: 1 }, ...extra });

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ ok: true, user: { id: "u1" }, teamIds: ["t1"] });
    db.extensionEvent.findMany.mockResolvedValue([]);
    db.extensionEvent.createMany.mockResolvedValue({ count: 0 });
    db.extensionStateItem.count.mockResolvedValue(0);
    db.extensionStateItem.findUnique.mockResolvedValue(null);
});

describe("POST /extension/sync/events", () => {
    it("answers each event: stored, already stored, repeated in the batch, or rejected", async () => {
        db.extensionEvent.findMany.mockResolvedValue([{ eventId: "old" }]);
        const res = await postEvents(post("http://x/extension/sync/events", {
            events: [ev("new"), ev("old"), ev("new"), ev("bad", { feature: "replier" }), ev("bad2", { type: "lower" })]
        }));
        const { results } = await res.json();
        expect(results).toEqual(expect.arrayContaining([
            { event_id: "new", status: "ok" },
            { event_id: "old", status: "duplicate" },
            expect.objectContaining({ event_id: "bad", status: "rejected" }),
            expect.objectContaining({ event_id: "bad2", status: "rejected" })
        ]));
        expect(results.filter((r: any) => r.event_id === "new").map((r: any) => r.status).sort()).toEqual(["duplicate", "ok"]);
        expect(db.extensionEvent.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it("requires a valid extension sign-in", async () => {
        mockAuth.mockResolvedValue({ ok: false, status: 401, code: "MISSING_TOKEN", error: "Missing authorization token" });
        expect((await postEvents(post("http://x", { events: [ev("a")] }))).status).toBe(401);
    });
});

describe("/extension/sync/state", () => {
    it("stores only the store edition's keys", async () => {
        const at = new Date().toISOString();
        const res = await postState(post("http://x", { ops: [
            { key: "or_campaigns", item: "c1", value: { name: "C" }, changed_at: at },
            { key: "replier_threads", item: "t1", value: {}, changed_at: at },
            { key: "pruner_connections", item: "s", value: {}, changed_at: at }
        ] }));
        expect(await res.json()).toMatchObject({ applied: 1, rejected: 2 });
        expect(db.extensionStateItem.upsert).toHaveBeenCalledTimes(1);
    });

    it("never lets an older change overwrite a newer one", async () => {
        db.extensionStateItem.findUnique.mockResolvedValue({ changedAt: new Date() });
        await postState(post("http://x", { ops: [{ key: "or_settings", item: "", value: { a: 1 }, changed_at: new Date(Date.now() - 60_000).toISOString() }] }));
        expect(db.extensionStateItem.upsert).not.toHaveBeenCalled();
    });

    it("refuses new rows past the per-user cap", async () => {
        db.extensionStateItem.count.mockResolvedValue(50_000);
        const res = await postState(post("http://x", { ops: [{ key: "or_settings", item: "", value: 1, changed_at: new Date().toISOString() }] }));
        expect(await res.json()).toMatchObject({ applied: 0, rejected: 1 });
    });

    it("pages through stored rows after a (key, item) cursor", async () => {
        db.extensionStateItem.findMany.mockResolvedValue([{ key: "or_settings", item: "", value: 1 }]);
        const res = await getState(new Request("http://x/extension/sync/state?after_key=commentor_stats&after_item=") as any);
        expect(await res.json()).toEqual({ rows: [{ key: "or_settings", item: "", value: 1 }], next: null });
        expect(db.extensionStateItem.findMany.mock.calls[0][0].where).toMatchObject({ userId: "u1", deleted: false });
    });
});
