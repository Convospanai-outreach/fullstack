import { beforeEach, describe, expect, it, vi } from "vitest";

const imap = vi.hoisted(() => ({
    connect: vi.fn(),
    list: vi.fn(),
    getMailboxLock: vi.fn(),
    search: vi.fn(),
    fetchOne: vi.fn(),
    messageDelete: vi.fn(),
    messageMove: vi.fn(),
    messageFlagsAdd: vi.fn(),
    logout: vi.fn(),
}));
const db = vi.hoisted(() => ({
    $executeRaw: vi.fn(),
    connectedMailbox: { findFirst: vi.fn() },
    campaign: { findFirst: vi.fn() },
    warmupSeedMailbox: { count: vi.fn(), findMany: vi.fn() },
    sequenceStep: { findFirst: vi.fn() },
    team: { findUnique: vi.fn() },
    email: { create: vi.fn() },
    emailEvent: { create: vi.fn() },
}));
const sends = vi.hoisted(() => ({ resend: vi.fn(), gmail: vi.fn(), smtp: vi.fn(), reserve: vi.fn(), release: vi.fn() }));
const enqueue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn(async (s: { plain?: string }) => s?.plain) }));
vi.mock("imapflow", () => ({ ImapFlow: vi.fn(function () { return imap; }) }));
vi.mock("mailparser", () => ({
    simpleParser: vi.fn(async () => ({
        headers: new Map([["authentication-results", "mx; dkim=pass header.d=acme.test; spf=pass; dmarc=pass"]]),
        from: { value: [{ address: "sales@acme.test" }] },
    })),
}));
vi.mock("./resendMailboxService", () => ({ sendViaResendMailbox: sends.resend }));
vi.mock("./googleMailboxService", () => ({ sendViaGmailMailbox: sends.gmail, reserveMailboxSend: sends.reserve, releaseMailboxSend: sends.release }));
vi.mock("./smtpConfigService", () => ({ sendViaSmtpMailbox: sends.smtp }));
vi.mock("./emailService", () => ({
    emailService: { addTrackingLinks: (body: string) => `${body}<footer>unsubscribe</footer>` },
    resolveEmailFooterText: () => "footer",
}));

import { effectivePlacementVerdict, locateCopy, readPlacementState, requestPlacementCheck, runPlacementCheck, withStuckCheckFailed, writePlacementState } from "./inboxPlacementCheck";

const gmailInbox = { id: "i1", email: "test1@gmail.com", host: "imap.gmail.com", port: 993, secure: true, user: "test1@gmail.com", encryptedPassword: { plain: "pw" }, createdAt: new Date(1) };
const yahooInbox = { id: "i2", email: "test2@yahoo.com", host: "imap.mail.yahoo.com", port: 993, secure: true, user: "test2@yahoo.com", encryptedPassword: { plain: "pw" }, createdAt: new Date(2) };
const lock = { release: vi.fn() };

function queuedState(extra: Record<string, unknown> = {}) {
    return { placement: { runId: "run-1", status: "queued", requestedBy: "u1", startedAt: new Date().toISOString(), checkedAt: null, campaignId: null, stepId: null, contentSource: "sample", sentTo: null, results: [], verdict: null, error: null, ...extra }, inboundDomain: "in.acme.test" };
}

beforeEach(() => {
    vi.clearAllMocks();
    imap.connect.mockResolvedValue(undefined);
    imap.logout.mockResolvedValue(undefined);
    imap.getMailboxLock.mockResolvedValue(lock);
    imap.fetchOne.mockResolvedValue({ source: Buffer.from("raw") });
    imap.messageDelete.mockResolvedValue(true);
    imap.list.mockResolvedValue([{ path: "INBOX" }, { path: "[Gmail]/Spam", specialUse: "\\Junk" }]);
    db.team.findUnique.mockResolvedValue({ mailingAddress: null, branding: null });
    db.sequenceStep.findFirst.mockResolvedValue(null);
    db.warmupSeedMailbox.findMany.mockResolvedValue([gmailInbox, yahooInbox]);
    sends.resend.mockResolvedValue({ success: true });
});

describe("writePlacementState", () => {
    it("merges the placement key with jsonb_set instead of replacing metadata", async () => {
        await writePlacementState("t1", "m1", queuedState().placement as never);
        const [strings, json] = db.$executeRaw.mock.calls[0]!;
        expect((strings as string[]).join("?")).toMatch(/jsonb_set\(/);
        expect((strings as string[]).join("?")).toMatch(/'\{placement\}'/);
        expect(JSON.parse(json as string)).toMatchObject({ runId: "run-1" });
    });
});

describe("requestPlacementCheck", () => {
    beforeEach(() => {
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", provider: "RESEND", metadata: { inboundDomain: "in.acme.test" } });
        db.warmupSeedMailbox.count.mockResolvedValue(2);
    });

    it("queues a job and records a queued run", async () => {
        const state = await requestPlacementCheck({ teamId: "t1", mailboxId: "m1", userId: "u1" });
        expect(state.status).toBe("queued");
        expect(enqueue).toHaveBeenCalledWith("inbox_placement_check", expect.objectContaining({ mailboxId: "m1", runId: state.runId }), expect.objectContaining({ teamId: "t1" }));
    });

    it("refuses without test inboxes, and more than once an hour", async () => {
        db.warmupSeedMailbox.count.mockResolvedValueOnce(0);
        await expect(requestPlacementCheck({ teamId: "t1", mailboxId: "m1", userId: "u1" })).rejects.toMatchObject({ code: "NO_TEST_INBOXES" });
        db.connectedMailbox.findFirst.mockResolvedValueOnce({ id: "m1", provider: "RESEND", metadata: queuedState({ status: "done" }) });
        await expect(requestPlacementCheck({ teamId: "t1", mailboxId: "m1", userId: "u1" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("allows a new run right after a failed one, and refuses unsupported providers", async () => {
        db.connectedMailbox.findFirst.mockResolvedValueOnce({ id: "m1", provider: "RESEND", metadata: queuedState({ status: "failed" }) });
        await expect(requestPlacementCheck({ teamId: "t1", mailboxId: "m1", userId: "u1" })).resolves.toMatchObject({ status: "queued" });
        db.connectedMailbox.findFirst.mockResolvedValueOnce({ id: "m1", provider: "MICROSOFT_365", metadata: null });
        await expect(requestPlacementCheck({ teamId: "t1", mailboxId: "m1", userId: "u1" })).rejects.toMatchObject({ code: "UNSUPPORTED_PROVIDER" });
    });
});

describe("locateCopy", () => {
    const inbox = { id: "i1", address: "test1@gmail.com", host: "imap.gmail.com", port: 993, secure: true, user: "u", password: "pw", provider: "gmail" as const };

    it("reports spam, reads with fetch only, deletes the copy, and never moves or flags it", async () => {
        imap.search.mockImplementation(async () => (imap.getMailboxLock.mock.calls.at(-1)?.[0] === "[Gmail]/Spam" ? [7] : []));
        const found = await locateCopy(inbox, "sales@acme.test", "ref1", new Date(), 0, 0);
        expect(found.folder).toBe("spam");
        expect(found.auth).toMatchObject({ dkim: "pass", aligned: true });
        expect(imap.messageDelete).toHaveBeenCalledWith("7", { uid: true });
        expect(imap.messageMove).not.toHaveBeenCalled();
        expect(imap.messageFlagsAdd).not.toHaveBeenCalled();
    });

    it("detects Gmail Promotions in the inbox", async () => {
        imap.search.mockImplementation(async (query: Record<string, unknown>) => (query["gmraw"] || imap.getMailboxLock.mock.calls.at(-1)?.[0] === "INBOX" ? [3] : []));
        expect((await locateCopy(inbox, "sales@acme.test", "ref1", new Date(), 0, 0)).folder).toBe("promotions");
    });

    it("reports missing, login failures and undecryptable passwords without throwing or leaking server text", async () => {
        imap.search.mockResolvedValue([]);
        expect((await locateCopy(inbox, "sales@acme.test", "ref1", new Date(), 0, 0)).folder).toBe("missing");
        imap.connect.mockRejectedValueOnce(new Error("AUTHENTICATIONFAILED user secret-login@gmail.com"));
        const login = await locateCopy(inbox, "sales@acme.test", "ref1", new Date(), 0, 0);
        expect(login).toEqual({ folder: "error", auth: null, error: "could not log in to the test inbox" });
        expect(await locateCopy({ ...inbox, password: null }, "sales@acme.test", "ref1", new Date(), 0, 0)).toMatchObject({ folder: "error", error: expect.stringMatching(/decrypted/) });
    });

    it("reports an error, not missing, when the spam folder is not visible over IMAP", async () => {
        imap.list.mockResolvedValue([{ path: "INBOX" }, { path: "Sent" }]);
        imap.search.mockResolvedValue([]);
        expect(await locateCopy(inbox, "sales@acme.test", "ref1", new Date(), 0, 0)).toMatchObject({ folder: "error", error: expect.stringMatching(/spam folder/) });
    });

    it("falls back to the newest mail from the sender when body search finds nothing, and checks the token", async () => {
        imap.search.mockImplementation(async (query: Record<string, unknown>) => (query["from"] && imap.getMailboxLock.mock.calls.at(-1)?.[0] === "INBOX" ? [8, 9] : []));
        imap.fetchOne.mockImplementation(async (uid: string) => ({ source: Buffer.from(uid === "9" ? "other mail" : "body Ref ref1 footer") }));
        const found = await locateCopy({ ...inbox, provider: "yahoo" }, "sales@acme.test", "ref1", new Date(), 0, 0);
        expect(found.folder).toBe("inbox");
        expect(imap.search).toHaveBeenCalledWith({ from: "sales@acme.test", since: expect.any(Date) }, { uid: true });
        expect(imap.messageDelete).toHaveBeenCalledWith("8", { uid: true });
        expect(imap.messageDelete).not.toHaveBeenCalledWith("9", expect.anything());
    });
});

describe("runPlacementCheck", () => {
    it("sends one copy per test inbox without creating Email rows, and does not resend on a retry", async () => {
        db.connectedMailbox.findFirst.mockResolvedValue({ provider: "RESEND", status: "CONNECTED", email: "sales@acme.test", metadata: queuedState() });
        imap.search.mockResolvedValue([]); // copies never arrive: keeps the test fast through the IMAP path
        const first = await runPlacementCheck({ teamId: "t1", mailboxId: "m1", runId: "run-1" }, { waitMs: 0, pollMs: 0 });
        expect(first).toEqual({ level: "amber" });
        expect(sends.resend).toHaveBeenCalledTimes(2);
        expect(sends.resend.mock.calls[0]![0]).toMatchObject({ trackingId: "placement-run-1", to: "test1@gmail.com" });
        expect(db.email.create).not.toHaveBeenCalled();
        expect(db.emailEvent.create).not.toHaveBeenCalled();
        const stored = db.$executeRaw.mock.calls.map((call) => String(call[1])).join(" ");
        expect(stored).not.toContain("test1@gmail.com"); // customers can read this metadata: ids only, never test addresses
        expect(stored).toContain('"sentTo":["i1","i2"]');

        sends.resend.mockClear();
        db.connectedMailbox.findFirst.mockResolvedValue({ provider: "RESEND", status: "CONNECTED", email: "sales@acme.test", metadata: queuedState({ status: "running", sentTo: ["i1"], token: "ref1" }) });
        const retry = await runPlacementCheck({ teamId: "t1", mailboxId: "m1", runId: "run-1" }, { waitMs: 0, pollMs: 0 });
        expect(sends.resend).not.toHaveBeenCalled();
        expect(retry).toEqual({ level: "amber" }); // re-read the inboxes with the stored token instead of failing

        db.connectedMailbox.findFirst.mockResolvedValue({ provider: "RESEND", status: "CONNECTED", email: "sales@acme.test", metadata: queuedState({ status: "running", sentTo: ["i1"] }) });
        expect(await runPlacementCheck({ teamId: "t1", mailboxId: "m1", runId: "run-1" })).toMatchObject({ failed: expect.stringMatching(/interrupted/) });
        expect(sends.resend).not.toHaveBeenCalled();
    });

    it("ignores a job whose run was replaced", async () => {
        db.connectedMailbox.findFirst.mockResolvedValue({ provider: "RESEND", status: "CONNECTED", email: "sales@acme.test", metadata: queuedState({ runId: "newer" }) });
        expect(await runPlacementCheck({ teamId: "t1", mailboxId: "m1", runId: "run-1" })).toEqual({ skipped: "stale_run" });
        expect(sends.resend).not.toHaveBeenCalled();
    });
});

describe("readPlacementState and effectivePlacementVerdict", () => {
    it("marks a queued or running check older than 15 minutes as failed", () => {
        const old = readPlacementState(queuedState({ startedAt: new Date(Date.now() - 16 * 60_000).toISOString() }));
        expect(withStuckCheckFailed(old)?.status).toBe("failed");
        expect(withStuckCheckFailed(readPlacementState(queuedState()))?.status).toBe("queued");
    });

    it("treats a missing, queued or unreadable state as amber, never red", () => {
        expect(readPlacementState({ placement: { nonsense: true } })).toBeNull();
        expect(effectivePlacementVerdict(null).level).toBe("amber");
        expect(effectivePlacementVerdict(readPlacementState(queuedState())).level).toBe("amber");
    });
});
