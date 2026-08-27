import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    connectedMailbox: { findMany: vi.fn() },
    warmupSeedMailbox: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

const mockAssertMailboxCanSend = vi.hoisted(() => vi.fn());
const mockMarkMailboxSend = vi.hoisted(() => vi.fn());
const mockSendViaGmailMailbox = vi.hoisted(() => vi.fn());
vi.mock("../googleMailboxService", () => ({
    assertMailboxCanSend: mockAssertMailboxCanSend,
    markMailboxSend: mockMarkMailboxSend,
    sendViaGmailMailbox: mockSendViaGmailMailbox,
}));

const mockGetSmtpConfig = vi.hoisted(() => vi.fn());
vi.mock("../smtpConfigService", () => ({ getSmtpConfig: mockGetSmtpConfig }));

const mockSendViaSMTP = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: mockSendViaSMTP }));

const mockEnqueue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));

// ENCRYPTION_KEY is read once at module load time, so it must be stubbed before the
// module's first (dynamic) import below - see smtpConfigService.test.ts for the same pattern.
const TEST_ENCRYPTION_KEY = "0".repeat(64);

let sendWarmupSeedTraffic: typeof import("../warmupSeedService").sendWarmupSeedTraffic;
let sendWarmupSeedReply: typeof import("../warmupSeedService").sendWarmupSeedReply;
let encryptSeedSecret: typeof import("../warmupSeedService").encryptSeedSecret;

beforeAll(async () => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    const mod = await import("../warmupSeedService");
    sendWarmupSeedTraffic = mod.sendWarmupSeedTraffic;
    sendWarmupSeedReply = mod.sendWarmupSeedReply;
    encryptSeedSecret = mod.encryptSeedSecret;
});

function seedMailbox(overrides: any = {}) {
    return {
        id: "seed-1",
        email: "seed1@warmup.craftmyfunnel.live",
        fromName: "Alex",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "seed1",
        dailyCapacity: 20,
        sentToday: 0,
        sentTodayDate: null,
        status: "ACTIVE",
        ...overrides,
    };
}

describe("sendWarmupSeedTraffic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.warmupSeedMailbox.update.mockResolvedValue({});
        mockAssertMailboxCanSend.mockResolvedValue({ ok: true });
        mockMarkMailboxSend.mockResolvedValue({});
    });

    it("sends via Gmail for a GOOGLE_WORKSPACE warming mailbox and reserves a random reply", async () => {
        mockDb.connectedMailbox.findMany.mockResolvedValue([
            { id: "mailbox-1", teamId: "team-1", provider: "GOOGLE_WORKSPACE", isWarmingUp: true, status: "CONNECTED" },
        ]);
        mockDb.warmupSeedMailbox.findMany.mockResolvedValue([seedMailbox()]);
        mockDb.warmupSeedMailbox.findUnique.mockResolvedValue(seedMailbox());
        mockSendViaGmailMailbox.mockResolvedValue({ success: true, messageId: "msg-1" });

        const result = await sendWarmupSeedTraffic();

        expect(result.sent).toBe(1);
        expect(mockSendViaGmailMailbox).toHaveBeenCalledWith(
            expect.objectContaining({ teamId: "team-1", mailboxId: "mailbox-1", to: "seed1@warmup.craftmyfunnel.live" })
        );
        expect(mockMarkMailboxSend).toHaveBeenCalledWith("team-1", "mailbox-1");
        expect(mockDb.warmupSeedMailbox.update).toHaveBeenCalled();
    });

    it("sends via SMTP for a non-Gmail warming mailbox", async () => {
        mockDb.connectedMailbox.findMany.mockResolvedValue([
            { id: "mailbox-2", teamId: "team-2", provider: "SMTP", isWarmingUp: true, status: "CONNECTED" },
        ]);
        mockDb.warmupSeedMailbox.findMany.mockResolvedValue([seedMailbox()]);
        mockDb.warmupSeedMailbox.findUnique.mockResolvedValue(seedMailbox());
        mockGetSmtpConfig.mockResolvedValue({ host: "smtp.team.com", port: 587, secure: false, user: "u", password: "p", fromName: "Team", fromEmail: "team@example.com" });
        mockSendViaSMTP.mockResolvedValue({ success: true, messageId: "msg-2" });

        const result = await sendWarmupSeedTraffic();

        expect(result.sent).toBe(1);
        expect(mockSendViaGmailMailbox).not.toHaveBeenCalled();
        expect(mockSendViaSMTP).toHaveBeenCalled();
    });

    it("skips a mailbox that is throttled or at its warmup limit", async () => {
        mockDb.connectedMailbox.findMany.mockResolvedValue([
            { id: "mailbox-3", teamId: "team-3", provider: "GOOGLE_WORKSPACE", isWarmingUp: true, status: "CONNECTED" },
        ]);
        mockAssertMailboxCanSend.mockResolvedValue({ ok: false, reason: "Daily send limit reached." });

        const result = await sendWarmupSeedTraffic();

        expect(result.sent).toBe(0);
        expect(mockSendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("stops once the seed pool has no eligible mailbox left for today", async () => {
        mockDb.connectedMailbox.findMany.mockResolvedValue([
            { id: "mailbox-4", teamId: "team-4", provider: "GOOGLE_WORKSPACE", isWarmingUp: true, status: "CONNECTED" },
        ]);
        mockDb.warmupSeedMailbox.findMany.mockResolvedValue([seedMailbox({ sentToday: 20, sentTodayDate: new Date() })]);

        const result = await sendWarmupSeedTraffic();

        expect(result.sent).toBe(0);
        expect(mockSendViaGmailMailbox).not.toHaveBeenCalled();
    });
});

describe("sendWarmupSeedReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.warmupSeedMailbox.update.mockResolvedValue({});
    });

    it("decrypts the seed mailbox's password and sends the reply via SMTP", async () => {
        const encrypted = await encryptSeedSecret("super-secret-password");
        mockDb.warmupSeedMailbox.findUnique.mockResolvedValue(seedMailbox({ encryptedPassword: encrypted }));
        mockSendViaSMTP.mockResolvedValue({ success: true, messageId: "reply-1" });

        const result = await sendWarmupSeedReply({ seedMailboxId: "seed-1", toEmail: "customer@example.com", subject: "Re: Quick question" });

        expect(result).toEqual({ success: true, messageId: "reply-1" });
        expect(mockSendViaSMTP).toHaveBeenCalledWith(
            expect.objectContaining({ host: "smtp.example.com", user: "seed1", password: "super-secret-password" }),
            expect.objectContaining({ to: "customer@example.com", subject: "Re: Quick question" })
        );
    });

    it("skips when the seed mailbox is missing or inactive", async () => {
        mockDb.warmupSeedMailbox.findUnique.mockResolvedValue(null);

        const result = await sendWarmupSeedReply({ seedMailboxId: "missing", toEmail: "customer@example.com", subject: "Re:" });

        expect(result).toEqual({ skipped: true, reason: "seed_mailbox_unavailable" });
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("throws when required payload fields are missing", async () => {
        await expect(sendWarmupSeedReply({})).rejects.toThrow(/seedMailboxId\/toEmail/);
    });
});
