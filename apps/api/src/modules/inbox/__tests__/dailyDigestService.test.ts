import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    user: { findMany: vi.fn() },
    digestLog: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    message: { count: vi.fn(), findMany: vi.fn() },
    overseerNudge: { count: vi.fn(), findMany: vi.fn() },
    meeting: { findMany: vi.fn(), count: vi.fn() },
    email: { count: vi.fn() },
}));
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/notifications", () => ({ SYSTEM_EMAIL_FROM: "CraftMyFunnel <contact.us@craftmyfunnel.live>" }));
vi.mock("resend", () => ({
    Resend: class {
        emails = { send: sendEmail };
    },
}));

import { collectDigestData, isDigestEmpty, renderDigestEmail, runDailyDigest, type DigestData } from "../dailyDigestService";
import { localDate, localDayRange, localHour } from "../localDay";

// 08:15 IST on 2026-09-30.
const eightFifteenIst = new Date("2026-09-30T02:45:00Z");

function emptyData(overrides: Partial<DigestData> = {}): DigestData {
    return {
        recipientName: "Priya",
        unreadReplies: { count: 0, top: [] },
        stalledLeads: { count: 0, top: [] },
        meetingsToday: { count: 0, top: [] },
        yesterday: { emailsSent: 0, replies: 0, meetingsBooked: 0 },
        ...overrides,
    };
}

function stubCounts({ unread = 0 } = {}) {
    mockDb.message.count.mockResolvedValue(unread);
    mockDb.message.findMany.mockResolvedValue(unread ? [{ content: "<p>Yes, let's talk</p>", lead: { fullName: "Asha", email: null } }] : []);
    mockDb.overseerNudge.count.mockResolvedValue(0);
    mockDb.overseerNudge.findMany.mockResolvedValue([]);
    mockDb.meeting.findMany.mockResolvedValue([]);
    mockDb.meeting.count.mockResolvedValue(0);
    mockDb.email.count.mockResolvedValue(0);
}

const user = (overrides: any = {}) => ({
    id: "user-1",
    email: "priya@example.test",
    name: "Priya",
    settings: { notifications: { emailGlobal: true, digestEnabled: true } },
    memberships: [{ teamId: "team-a" }],
    ...overrides,
});

describe("localDay helpers (Asia/Kolkata)", () => {
    it("computes the local hour, date and day boundaries", () => {
        expect(localHour(eightFifteenIst)).toBe(8);
        expect(localDate(eightFifteenIst)).toEqual(new Date("2026-09-30T00:00:00Z"));
        expect(localDayRange(eightFifteenIst, 0)).toEqual({
            start: new Date("2026-09-29T18:30:00Z"),
            end: new Date("2026-09-30T18:30:00Z"),
        });
        expect(localDayRange(eightFifteenIst, -1).start).toEqual(new Date("2026-09-28T18:30:00Z"));
    });
});

describe("renderDigestEmail", () => {
    it("escapes lead-controlled content and links to the inbox", () => {
        const email = renderDigestEmail(emptyData({
            unreadReplies: { count: 4, top: [{ leadName: "<img src=x onerror=alert(1)>", snippet: "Tuesday & <b>Wednesday</b>" }] },
            stalledLeads: { count: 1, top: ["Resend step 2 to \"Acme\""] },
            meetingsToday: { count: 1, top: [{ title: "Demo <script>", startTime: new Date("2026-09-30T05:30:00Z") }] },
        }));

        expect(email.subject).toBe("Today: 4 unread replies, 1 stalled lead, 1 meeting today");
        expect(email.html).not.toContain("<img src=x");
        expect(email.html).not.toContain("<script>");
        expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(email.html).toContain("Tuesday &amp; &lt;b&gt;Wednesday&lt;/b&gt;");
        expect(email.html).toContain('href="https://craftmyfunnel.live/inbox"');
        expect(email.html).toMatch(/11:00\s?am/i);
        expect(email.text).toContain("Open your inbox: https://craftmyfunnel.live/inbox");
    });

    it("treats a digest with nothing to report as empty", () => {
        expect(isDigestEmpty(emptyData())).toBe(true);
        expect(isDigestEmpty(emptyData({ yesterday: { emailsSent: 3, replies: 0, meetingsBooked: 0 } }))).toBe(false);
    });
});

describe("collectDigestData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stubCounts({ unread: 2 });
    });

    it("scopes every count to the user's teams and uses IST day boundaries", async () => {
        const data = await collectDigestData(["team-a", "team-b"], "Priya", eightFifteenIst);

        expect(mockDb.message.count).toHaveBeenCalledWith({ where: { direction: "INBOUND", isRead: false, lead: { teamId: { in: ["team-a", "team-b"] } } } });
        expect(mockDb.meeting.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: { in: ["team-a", "team-b"] }, startTime: { gte: new Date("2026-09-29T18:30:00Z"), lt: new Date("2026-09-30T18:30:00Z") } },
        }));
        expect(mockDb.email.count).toHaveBeenCalledWith({
            where: { campaign: { teamId: { in: ["team-a", "team-b"] } }, createdAt: { gte: new Date("2026-09-28T18:30:00Z"), lt: new Date("2026-09-29T18:30:00Z") } },
        });
        expect(data.unreadReplies.top).toEqual([{ leadName: "Asha", snippet: "Yes, let's talk" }]);
    });
});

describe("runDailyDigest", () => {
    const originalKey = process.env["RESEND_API_KEY"];

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["RESEND_API_KEY"] = "re_test";
        mockDb.user.findMany.mockResolvedValue([user()]);
        mockDb.digestLog.findUnique.mockResolvedValue(null);
        mockDb.digestLog.create.mockResolvedValue({});
        mockDb.digestLog.delete.mockResolvedValue({});
        sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });
        stubCounts({ unread: 1 });
    });

    afterEach(() => {
        process.env["RESEND_API_KEY"] = originalKey;
    });

    it("does nothing outside the 08:00 local hour", async () => {
        const result = await runDailyDigest(new Date("2026-09-30T03:45:00Z")); // 09:15 IST

        expect(result.sent).toBe(0);
        expect(mockDb.user.findMany).not.toHaveBeenCalled();
    });

    it("claims today's DigestLog row, then sends one email", async () => {
        const result = await runDailyDigest(eightFifteenIst);

        expect(mockDb.digestLog.create).toHaveBeenCalledWith({ data: { userId: "user-1", sentOn: new Date("2026-09-30T00:00:00Z") } });
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            from: "CraftMyFunnel <contact.us@craftmyfunnel.live>",
            to: "priya@example.test",
            subject: "Today: 1 unread reply",
        }));
        expect(result.sent).toBe(1);
    });

    it("is idempotent: skips a user already sent today, or claimed by another worker", async () => {
        mockDb.digestLog.findUnique.mockResolvedValueOnce({ id: "log-1" });
        await runDailyDigest(eightFifteenIst);
        expect(sendEmail).not.toHaveBeenCalled();

        mockDb.digestLog.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
        await runDailyDigest(eightFifteenIst);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("respects emailGlobal and digestEnabled", async () => {
        mockDb.user.findMany.mockResolvedValue([
            user({ id: "u-global-off", settings: { notifications: { emailGlobal: false, digestEnabled: true } } }),
            user({ id: "u-digest-off", settings: { notifications: { emailGlobal: true, digestEnabled: false } } }),
        ]);

        await runDailyDigest(eightFifteenIst);

        expect(mockDb.digestLog.create).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("skips the send entirely when every section is zero", async () => {
        stubCounts({ unread: 0 });

        const result = await runDailyDigest(eightFifteenIst);

        expect(result.skippedEmpty).toBe(1);
        expect(mockDb.digestLog.create).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("releases the claim when Resend rejects the send, so a later run can retry", async () => {
        sendEmail.mockResolvedValue({ data: null, error: { message: "rate limited" } });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const result = await runDailyDigest(eightFifteenIst);

        expect(mockDb.digestLog.delete).toHaveBeenCalledWith({ where: { userId_sentOn: { userId: "user-1", sentOn: new Date("2026-09-30T00:00:00Z") } } });
        expect(result).toMatchObject({ sent: 0, failed: 1 });
        consoleError.mockRestore();
    });
});
