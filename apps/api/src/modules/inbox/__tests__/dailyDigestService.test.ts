import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    user: { findMany: vi.fn() },
    digestLog: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    message: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    overseerNudge: { count: vi.fn(), findMany: vi.fn() },
    meeting: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    team: { findMany: vi.fn() },
    email: { count: vi.fn(), findMany: vi.fn() },
    approvalRequest: { count: vi.fn(), findMany: vi.fn() },
    connectedMailbox: { count: vi.fn(), findMany: vi.fn() },
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
        needsYou: [],
        goals: [],
        win: null,
        yesterday: { emailsSent: 0, replies: 0, meetingsBooked: 0 },
        ...overrides,
    };
}

function stubCounts({ unread = 0 } = {}) {
    mockDb.message.count.mockResolvedValue(unread);
    mockDb.message.findMany.mockResolvedValue(unread ? [{ id: "msg-1", content: "<p>Yes, let's talk</p>", createdAt: new Date(), lead: { fullName: "Asha", email: null } }] : []);
    mockDb.overseerNudge.count.mockResolvedValue(0);
    mockDb.overseerNudge.findMany.mockResolvedValue([]);
    mockDb.meeting.findMany.mockResolvedValue([]);
    mockDb.meeting.count.mockResolvedValue(0);
    mockDb.email.count.mockResolvedValue(0);
    mockDb.email.findMany.mockResolvedValue([]);
    mockDb.approvalRequest.count.mockResolvedValue(0);
    mockDb.approvalRequest.findMany.mockResolvedValue([]);
    mockDb.connectedMailbox.count.mockResolvedValue(0);
    mockDb.connectedMailbox.findMany.mockResolvedValue([]);
    mockDb.team.findMany.mockResolvedValue([]);
    mockDb.meeting.findFirst.mockResolvedValue(null);
    mockDb.message.findFirst.mockResolvedValue(null);
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

const entry = (title: string, href: string, detail: string | null = null, at: Date | null = null) => ({ title, detail, href, at });

describe("renderDigestEmail", () => {
    it("escapes lead-controlled content and deep-links each entry", () => {
        const email = renderDigestEmail(emptyData({
            needsYou: [
                { type: "unread_replies", count: 4, href: "/inbox", top: [entry("<img src=x onerror=alert(1)>", "/inbox?reply=m1", "Tuesday & <b>Wednesday</b>")] },
                { type: "stalled_leads", count: 1, href: "/inbox?tab=approvals", top: [entry('Resend step 2 to "Acme"', "/leads/l1")] },
                { type: "meetings_today", count: 1, href: "/calendar", top: [entry("Demo <script>", "/calendar", null, new Date("2026-09-30T05:30:00Z"))] },
            ],
            win: "<b>Asha</b> replied and is interested",
        }));

        expect(email.subject).toBe("Today: 4 unread replies, 1 stalled lead, 1 meeting today");
        expect(email.html).not.toContain("<img src=x");
        expect(email.html).not.toContain("<script>");
        expect(email.html).not.toContain("<b>");
        expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(email.html).toContain("Tuesday &amp; &lt;b&gt;Wednesday&lt;/b&gt;");
        expect(email.html).toContain('href="https://craftmyfunnel.live/inbox?reply=m1"');
        expect(email.html).toContain('href="https://craftmyfunnel.live/leads/l1"');
        expect(email.html).toContain('href="https://craftmyfunnel.live/inbox" style="color:#4f46e5;text-decoration:none">See all 4');
        expect(email.html).toMatch(/11:00\s?am/i);
        expect(email.text).toContain("https://craftmyfunnel.live/inbox?reply=m1");
        expect(email.text).toContain("Open your inbox: https://craftmyfunnel.live/inbox");
    });

    it("orders needs you, goal pace, the win, then yesterday", () => {
        const email = renderDigestEmail(emptyData({
            needsYou: [{ type: "approvals", count: 1, href: "/inbox?tab=approvals", top: [entry("Send email", "/inbox?tab=approvals")] }],
            goals: [{ teamName: null, goal: 10, booked: 4, behindBy: 2 }],
            win: "Meeting booked with Asha (Acme)",
            yesterday: { emailsSent: 12, replies: 2, meetingsBooked: 1 },
        }));

        const order = ["Waiting for your approval", "4 of 10 meetings booked this month. Behind by 2.", "Meeting booked with Asha (Acme)", "12 emails sent"];
        for (const body of [email.text, email.html]) {
            const positions = order.map((text) => body.indexOf(text));
            expect(positions.every((position) => position >= 0)).toBe(true);
            expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        }
    });

    it("says On pace and names the team for multi-team users", () => {
        const email = renderDigestEmail(emptyData({ goals: [{ teamName: "Acme <Sales>", goal: 8, booked: 5, behindBy: 0 }] }));

        expect(email.html).toContain("Acme &lt;Sales&gt;: 5 of 8 meetings booked this month. On pace.");
        expect(email.subject).toBe("Your daily CraftMyFunnel summary");
    });

    it("treats a digest with nothing to report as empty, even with a goal line", () => {
        expect(isDigestEmpty(emptyData())).toBe(true);
        expect(isDigestEmpty(emptyData({ goals: [{ teamName: null, goal: 10, booked: 0, behindBy: 1 }] }))).toBe(true);
        expect(isDigestEmpty(emptyData({ yesterday: { emailsSent: 3, replies: 0, meetingsBooked: 0 } }))).toBe(false);
        expect(isDigestEmpty(emptyData({ win: "Meeting booked with Asha" }))).toBe(false);
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
        expect(data.needsYou).toEqual([
            { type: "unread_replies", count: 2, href: "/inbox", top: [expect.objectContaining({ title: "Asha", detail: "Yes, let's talk", href: "/inbox?reply=msg-1" })] },
        ]);
    });

    it("keeps only the three most urgent non-empty items", async () => {
        mockDb.approvalRequest.count.mockResolvedValue(1);
        mockDb.overseerNudge.count.mockResolvedValue(2);
        mockDb.connectedMailbox.count.mockResolvedValue(1);

        const data = await collectDigestData(["team-a"], "Priya", eightFifteenIst);

        expect(data.needsYou.map((item) => item.type)).toEqual(["unread_replies", "approvals", "stalled_leads"]);
    });

    it("computes goal pace for this IST month and names teams only for multi-team users", async () => {
        mockDb.team.findMany.mockResolvedValue([{ id: "team-a", name: "Acme", monthlyMeetingGoal: 10 }]);
        mockDb.meeting.count.mockResolvedValue(4);
        const midMonth = new Date("2026-09-16T02:45:00Z");

        expect((await collectDigestData(["team-a"], null, midMonth)).goals).toEqual([{ teamName: null, goal: 10, booked: 4, behindBy: 2 }]);
        expect(mockDb.meeting.count).toHaveBeenCalledWith({
            where: { teamId: "team-a", createdAt: { gte: new Date("2026-08-31T18:30:00Z"), lt: new Date("2026-09-30T18:30:00Z") } },
        });
        expect((await collectDigestData(["team-a", "team-b"], null, midMonth)).goals[0]?.teamName).toBe("Acme");
    });

    it("picks yesterday's booked meeting as the win, else an interested reply", async () => {
        mockDb.meeting.findFirst.mockResolvedValueOnce({ title: "Intro", lead: { fullName: "Asha", email: null, company: "Acme" } });
        expect((await collectDigestData(["team-a"], null, eightFifteenIst)).win).toBe("Meeting booked with Asha (Acme)");
        expect(mockDb.meeting.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: { in: ["team-a"] }, createdAt: { gte: new Date("2026-09-28T18:30:00Z"), lt: new Date("2026-09-29T18:30:00Z") } },
        }));

        mockDb.message.findFirst.mockResolvedValueOnce({ lead: { fullName: null, email: "ravi@example.test", company: null } });
        expect((await collectDigestData(["team-a"], null, eightFifteenIst)).win).toBe("ravi@example.test replied and is interested");
        expect(mockDb.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ lead: { teamId: { in: ["team-a"] }, replyOutcome: { in: ["interested", "meeting_booked"] } } }),
        }));

        expect((await collectDigestData(["team-a"], null, eightFifteenIst)).win).toBeNull();
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
