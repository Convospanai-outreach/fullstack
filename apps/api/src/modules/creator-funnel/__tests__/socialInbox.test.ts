import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    socialAccount: { findMany: vi.fn(), findFirst: vi.fn() },
    socialContact: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    lead: { create: vi.fn(), updateMany: vi.fn() },
    message: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
}));
const graphCall = vi.hoisted(() => vi.fn());
const graphPostJson = vi.hoisted(() => vi.fn());
const isCreatorFunnelEnabled = vi.hoisted(() => vi.fn());
const applyFunnelEvent = vi.hoisted(() => vi.fn());
const onInboundReply = vi.hoisted(() => vi.fn());
const evaluate = vi.hoisted(() => vi.fn());
const queueDmReply = vi.hoisted(() => vi.fn());
const queueCommentReplies = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn(async (secret: any) => secret?.plain) }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled }));
vi.mock("../funnelStageService", () => ({ applyFunnelEvent }));
vi.mock("@/modules/inbox/inboundReplyNotifier", () => ({ onInboundReply }));
vi.mock("@/modules/governance/service/guardrailService", () => ({ guardrailService: { evaluate } }));
vi.mock("../keywordTriggers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../keywordTriggers")>()),
    queueDmReply,
    queueCommentReplies,
}));
vi.mock("../metaGraph", async (importOriginal) => ({ ...(await importOriginal<typeof import("../metaGraph")>()), graphCall, graphPostJson }));

import { extractDmEvents, fillContactProfile, ingestMetaWebhook, sendSocialReply } from "../socialInbox";
import { GraphError } from "../metaGraph";

const NOW = new Date("2030-01-07T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

function igDelivery(messaging: any[], accountId = "ig-1") {
    return { object: "instagram", entry: [{ id: accountId, time: NOW.getTime(), messaging }] };
}

function dm(overrides: any = {}, message: any = {}) {
    return {
        sender: { id: "igsid-9" },
        recipient: { id: "ig-1" },
        timestamp: NOW.getTime() - HOUR,
        message: { mid: "mid-1", text: "Is the course still open?", ...message },
        ...overrides,
    };
}

describe("extractDmEvents", () => {
    it("keeps new messages and deletions, and skips echoes, reactions, reads and the account's own sends", () => {
        const events = extractDmEvents(
            igDelivery([
                dm(),
                dm({}, { mid: "mid-echo", is_echo: true }),
                dm({ sender: { id: "ig-1" } }, { mid: "mid-own" }),
                { sender: { id: "igsid-9" }, recipient: { id: "ig-1" }, timestamp: 1, reaction: { mid: "mid-1", action: "react" } },
                { sender: { id: "igsid-9" }, recipient: { id: "ig-1" }, timestamp: 1, read: { mid: "mid-1" } },
                dm({}, { mid: "mid-2", is_deleted: true }),
            ])
        );
        expect(events).toEqual([
            expect.objectContaining({ kind: "message", platform: "INSTAGRAM", accountExternalId: "ig-1", senderId: "igsid-9", mid: "mid-1", content: "Is the course still open?" }),
            { kind: "deleted", platform: "INSTAGRAM", accountExternalId: "ig-1", mid: "mid-2" },
        ]);
    });

    it("stores placeholders instead of media URLs, and maps Page deliveries to Facebook", () => {
        const [photo] = extractDmEvents(igDelivery([dm({}, { text: undefined, attachments: [{ type: "image", payload: { url: "https://lookaside.example/secret.jpg" } }] })]));
        expect(photo).toMatchObject({ content: "[Photo]" });
        expect(JSON.stringify(photo)).not.toContain("lookaside");

        const [story] = extractDmEvents(igDelivery([dm({}, { reply_to: { story: { id: "s1", url: "https://x.example/s" } }, text: "love this" })]));
        expect(story).toMatchObject({ content: "[Replied to your story] love this" });

        const [fb] = extractDmEvents({ object: "page", entry: [{ id: "page-1", messaging: [dm({ recipient: { id: "page-1" } })] }] });
        expect(fb).toMatchObject({ platform: "FACEBOOK_PAGE", accountExternalId: "page-1" });

        expect(extractDmEvents({ object: "whatsapp_business_account", entry: [] })).toEqual([]);
    });
});

describe("ingestMetaWebhook", () => {
    const account = { id: "acc-ig", teamId: "team-a", platform: "INSTAGRAM" };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.socialAccount.findMany.mockResolvedValue([account]);
        isCreatorFunnelEnabled.mockResolvedValue(true);
        mockDb.socialContact.findUnique.mockResolvedValue(null);
        mockDb.lead.create.mockResolvedValue({ id: "lead-new" });
        mockDb.socialContact.create.mockResolvedValue({ id: "contact-1", leadId: "lead-new", name: null, handle: null });
        mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
        mockDb.message.create.mockImplementation(async ({ data }: any) => ({ id: `row-${data.externalId}`, leadId: data.leadId, createdAt: NOW }));
        mockDb.socialContact.updateMany.mockResolvedValue({ count: 1 });
        applyFunnelEvent.mockResolvedValue({ changed: true });
        graphCall.mockRejectedValue(new GraphError("no profile", false)); // background profile lookup
        queueDmReply.mockResolvedValue(false);
        queueCommentReplies.mockResolvedValue(0);
    });

    it("checks each DM against keyword triggers, including a retried one (the queue is idempotent)", async () => {
        await ingestMetaWebhook(igDelivery([dm()]), NOW);
        expect(queueDmReply).toHaveBeenCalledWith(account, { mid: "mid-1", senderId: "igsid-9", text: "Is the course still open?", leadId: "lead-new" }, NOW);

        mockDb.socialContact.findUnique.mockResolvedValue({ id: "contact-1", leadId: "lead-new", name: null, handle: null });
        mockDb.message.create.mockRejectedValue(uniqueViolation());
        await ingestMetaWebhook(igDelivery([dm()]), NOW);
        expect(queueDmReply).toHaveBeenCalledTimes(2);
    });

    it("matches keywords on what the person typed, not attachment placeholders", async () => {
        await ingestMetaWebhook(igDelivery([dm({}, { mid: "mid-p", text: undefined, attachments: [{ type: "image" }] })]), NOW);
        expect(queueDmReply).not.toHaveBeenCalled();
    });

    it("sends comments to the keyword triggers of every receiving account, and counts a failure so Meta retries", async () => {
        const delivery = { object: "instagram", entry: [{ id: "ig-1", changes: [{ field: "comments", value: { id: "c1", text: "GUIDE", from: { id: "u9", username: "asha" }, media: { id: "m1" } } }] }] };
        expect(await ingestMetaWebhook(delivery, NOW)).toEqual({ events: 1, stored: 0, failed: 0 });
        expect(queueCommentReplies).toHaveBeenCalledWith(expect.objectContaining({ commentId: "c1", authorId: "u9" }), [account], NOW);
        expect(mockDb.message.create).not.toHaveBeenCalled();

        queueCommentReplies.mockRejectedValueOnce(new Error("db down"));
        expect(await ingestMetaWebhook(delivery, NOW)).toEqual({ events: 1, stored: 0, failed: 1 });
    });

    it("creates a lead and contact for a new person, stores the message once, and alerts the team", async () => {
        const result = await ingestMetaWebhook(igDelivery([dm()]), NOW);
        expect(result).toEqual({ events: 1, stored: 1, failed: 0 });

        expect(mockDb.socialAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { platform: "INSTAGRAM", externalId: "ig-1", status: "CONNECTED" } }));
        expect(mockDb.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: { teamId: "team-a", source: "instagram_dm", status: "NEW" } }));
        expect(mockDb.socialContact.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { teamId: "team-a", socialAccountId: "acc-ig", externalUserId: "igsid-9", leadId: "lead-new", handle: null, name: null },
        }));
        expect(mockDb.message.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ leadId: "lead-new", direction: "INBOUND", platform: "INSTAGRAM", content: "Is the course still open?", externalId: "acc-ig:mid-1" }),
        }));
        expect(mockDb.socialContact.updateMany).toHaveBeenCalledWith({
            where: { id: "contact-1", OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: new Date(NOW.getTime() - HOUR) } }] },
            data: { lastInboundAt: new Date(NOW.getTime() - HOUR) },
        });
        expect(applyFunnelEvent).toHaveBeenCalledWith("team-a", "lead-new", "social_first_touch");
        expect(onInboundReply).toHaveBeenCalledWith(expect.objectContaining({ id: "row-acc-ig:mid-1", leadId: "lead-new", sentimentScore: null }));
    });

    it("skips a retried delivery it already stored, without alerting again", async () => {
        mockDb.socialContact.findUnique.mockResolvedValue({ id: "contact-1", leadId: "lead-1", name: "Asha", handle: "@asha" });
        mockDb.message.create.mockRejectedValue(uniqueViolation());

        const result = await ingestMetaWebhook(igDelivery([dm()]), NOW);

        expect(result).toEqual({ events: 1, stored: 0, failed: 0 });
        expect(mockDb.lead.create).not.toHaveBeenCalled();
        expect(mockDb.socialContact.updateMany).not.toHaveBeenCalled();
        expect(onInboundReply).not.toHaveBeenCalled();
    });

    it("stores nothing for teams without the creator funnel on", async () => {
        isCreatorFunnelEnabled.mockResolvedValue(false);
        expect(await ingestMetaWebhook(igDelivery([dm()]), NOW)).toEqual({ events: 1, stored: 0, failed: 0 });
        expect(mockDb.message.create).not.toHaveBeenCalled();
    });

    it("gives each team that connected the same account its own copy", async () => {
        mockDb.socialAccount.findMany.mockResolvedValue([account, { id: "acc-ig-b", teamId: "team-b", platform: "INSTAGRAM" }]);
        expect((await ingestMetaWebhook(igDelivery([dm()]), NOW)).stored).toBe(2);
        expect(mockDb.message.create.mock.calls.map(([arg]: any) => arg.data.externalId)).toEqual(["acc-ig:mid-1", "acc-ig-b:mid-1"]);
    });

    it("doesn't let a timestamp from the future stretch the reply window", async () => {
        await ingestMetaWebhook(igDelivery([dm({ timestamp: NOW.getTime() + 48 * HOUR })]), NOW);
        expect(mockDb.socialContact.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { lastInboundAt: NOW } }));
    });

    it("uses the contact created by a concurrent delivery", async () => {
        mockDb.socialContact.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "contact-1", leadId: "lead-1", name: null, handle: null });
        mockDb.$transaction.mockRejectedValue(uniqueViolation());

        expect((await ingestMetaWebhook(igDelivery([dm()]), NOW)).stored).toBe(1);
        expect(mockDb.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadId: "lead-1" }) }));
        expect(applyFunnelEvent).not.toHaveBeenCalled();
    });

    it("deletes CMf's copy when the person deletes their message", async () => {
        mockDb.message.deleteMany.mockResolvedValue({ count: 1 });
        await ingestMetaWebhook(igDelivery([dm({}, { mid: "mid-1", is_deleted: true })]), NOW);
        expect(mockDb.message.deleteMany).toHaveBeenCalledWith({ where: { direction: "INBOUND", externalId: { in: ["acc-ig:mid-1"] } } });
        expect(mockDb.message.create).not.toHaveBeenCalled();
    });

    it("keeps going after one event fails, and reports the failure so Meta retries", async () => {
        mockDb.message.create
            .mockRejectedValueOnce(new Error("db down"))
            .mockImplementationOnce(async ({ data }: any) => ({ id: "row-2", leadId: data.leadId, createdAt: NOW }));

        const result = await ingestMetaWebhook(igDelivery([dm(), dm({}, { mid: "mid-2" })]), NOW);
        expect(result).toEqual({ events: 2, stored: 1, failed: 1 });
    });
});

describe("fillContactProfile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.socialContact.findUnique.mockResolvedValue({
            id: "contact-1",
            leadId: "lead-1",
            externalUserId: "igsid-9",
            socialAccount: { teamId: "team-a", platform: "INSTAGRAM", parentExternalId: "page-1", status: "CONNECTED", encryptedToken: { plain: "user-token" } },
        });
        mockDb.socialAccount.findFirst.mockResolvedValue({ status: "CONNECTED", encryptedToken: { plain: "page-token" } });
    });

    it("looks up an Instagram profile with the linked Page's token and names the lead only if it has no name", async () => {
        graphCall.mockResolvedValue({ name: "Asha\u0000 Rao", username: "asha.makes" });

        await fillContactProfile("contact-1");

        expect(mockDb.socialAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", platform: "FACEBOOK_PAGE", externalId: "page-1" } }));
        expect(graphCall).toHaveBeenCalledWith("GET", "igsid-9", { fields: "name,username" }, "page-token");
        expect(mockDb.socialContact.update).toHaveBeenCalledWith({ where: { id: "contact-1" }, data: { handle: "@asha.makes", name: "Asha Rao" } });
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead-1", fullName: null }, data: { fullName: "Asha Rao" } });
    });

    it("does nothing when the linked Page is disconnected, and never throws", async () => {
        mockDb.socialAccount.findFirst.mockResolvedValue({ status: "DISCONNECTED", encryptedToken: null });
        await fillContactProfile("contact-1");
        expect(graphCall).not.toHaveBeenCalled();

        mockDb.socialAccount.findFirst.mockResolvedValue({ status: "CONNECTED", encryptedToken: { plain: "page-token" } });
        graphCall.mockRejectedValue(new GraphError("(#230) consent", false));
        await expect(fillContactProfile("contact-1")).resolves.toBeUndefined();
        expect(mockDb.socialContact.update).not.toHaveBeenCalled();
    });
});

describe("sendSocialReply", () => {
    const igAccount = {
        id: "acc-ig",
        teamId: "team-a",
        platform: "INSTAGRAM",
        externalId: "ig-1",
        parentExternalId: "page-1",
        status: "CONNECTED",
        encryptedToken: { plain: "user-token" },
        scopes: ["instagram_manage_messages"],
    };
    const fbAccount = { ...igAccount, id: "acc-fb", platform: "FACEBOOK_PAGE", externalId: "page-1", parentExternalId: null, encryptedToken: { plain: "page-token" }, scopes: ["pages_messaging"] };

    const contact = (overrides: any = {}) => ({ externalUserId: "igsid-9", lastInboundAt: new Date(NOW.getTime() - 2 * HOUR), socialAccount: igAccount, ...overrides });
    const reply = (content = "Yes, it's open until Friday", platform: "INSTAGRAM" | "FACEBOOK" = "INSTAGRAM") =>
        sendSocialReply({ teamId: "team-a", userId: "user-1", leadId: "lead-1", replyMessageId: "msg-1", platform, content }, NOW);

    beforeEach(() => {
        vi.clearAllMocks();
        isCreatorFunnelEnabled.mockResolvedValue(true);
        mockDb.socialContact.findFirst.mockResolvedValue(contact());
        mockDb.socialAccount.findFirst.mockResolvedValue({ status: "CONNECTED", encryptedToken: { plain: "page-token" } });
        evaluate.mockResolvedValue({ isSafe: true, violations: [] });
        graphCall.mockResolvedValue({ recipient_id: "igsid-9", message_id: "mid-out" });
        graphPostJson.mockResolvedValue({ recipient_id: "psid-3", message_id: "mid-fb" });
        mockDb.user.findUnique.mockResolvedValue({ name: "Rep" });
        mockDb.message.create.mockResolvedValue({ id: "outbound-1" });
    });

    it("sends an Instagram reply with the linked Page's token and records it", async () => {
        await expect(reply()).resolves.toEqual({ id: "outbound-1" });

        expect(mockDb.socialContact.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", leadId: "lead-1", socialAccount: { platform: "INSTAGRAM" } } }));
        expect(graphCall).toHaveBeenCalledWith(
            "POST",
            "me/messages",
            { recipient: '{"id":"igsid-9"}', message: '{"text":"Yes, it\'s open until Friday"}' },
            "page-token"
        );
        expect(mockDb.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", direction: "OUTBOUND", platform: "INSTAGRAM", sender: "Rep", status: "sent", externalId: "acc-ig:mid-out" }),
        });
        expect(mockDb.message.update).toHaveBeenCalledWith({ where: { id: "msg-1" }, data: { isRead: true } });
    });

    it("sends a Facebook reply as a RESPONSE from the Page", async () => {
        mockDb.socialContact.findFirst.mockResolvedValue(contact({ externalUserId: "psid-3", socialAccount: fbAccount }));
        await reply("Thanks!", "FACEBOOK");
        expect(mockDb.socialAccount.findFirst).not.toHaveBeenCalled();
        expect(graphPostJson).toHaveBeenCalledWith(
            "page-1/messages",
            { recipient: { id: "psid-3" }, messaging_type: "RESPONSE", message: { text: "Thanks!" } },
            "page-token"
        );
        expect(graphCall).not.toHaveBeenCalled();
        expect(mockDb.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ platform: "FACEBOOK", externalId: "acc-fb:mid-fb" }) });
    });

    it("refuses once 24 hours have passed since the person's last message", async () => {
        mockDb.socialContact.findFirst.mockResolvedValue(contact({ lastInboundAt: new Date(NOW.getTime() - 25 * HOUR) }));
        await expect(reply()).rejects.toMatchObject({ statusCode: 409, code: "REPLY_WINDOW_CLOSED" });
        expect(graphCall).not.toHaveBeenCalled();
    });

    it("counts Instagram's 1,000-byte limit in bytes, not characters", async () => {
        await expect(reply("é".repeat(501))).rejects.toMatchObject({ statusCode: 400, code: "MESSAGE_TOO_LONG" });
        await expect(reply("e".repeat(1000))).resolves.toBeTruthy();
    });

    it("refuses when the flag is off, the account is disconnected, messaging wasn't granted, or the Page is gone", async () => {
        isCreatorFunnelEnabled.mockResolvedValueOnce(false);
        await expect(reply()).rejects.toMatchObject({ statusCode: 403, code: "FEATURE_DISABLED" });

        mockDb.socialContact.findFirst.mockResolvedValueOnce(contact({ socialAccount: { ...igAccount, status: "NEEDS_RECONNECT" } }));
        await expect(reply()).rejects.toMatchObject({ statusCode: 409, code: "ACCOUNT_DISCONNECTED" });

        mockDb.socialContact.findFirst.mockResolvedValueOnce(contact({ socialAccount: { ...igAccount, scopes: ["instagram_basic"] } }));
        await expect(reply()).rejects.toMatchObject({ statusCode: 409, code: "MISSING_PERMISSION" });

        mockDb.socialAccount.findFirst.mockResolvedValueOnce({ status: "DISCONNECTED", encryptedToken: null });
        await expect(reply()).rejects.toMatchObject({ statusCode: 409, code: "PAGE_DISCONNECTED" });

        mockDb.socialContact.findFirst.mockResolvedValueOnce(null);
        await expect(reply()).rejects.toMatchObject({ statusCode: 404 });

        expect(graphCall).not.toHaveBeenCalled();
    });

    it("refuses content the team's guardrails block", async () => {
        evaluate.mockResolvedValue({ isSafe: false, violations: [{ reason: "Blocked phrase" }] });
        await expect(reply()).rejects.toMatchObject({ statusCode: 403, message: "Blocked phrase" });
        expect(graphCall).not.toHaveBeenCalled();
    });

    it("doesn't record a reply Meta refused or didn't confirm", async () => {
        graphCall.mockRejectedValueOnce(new GraphError("Meta didn't answer in time.", true));
        await expect(reply()).rejects.toMatchObject({ statusCode: 502, code: "SEND_UNCONFIRMED" });

        graphCall.mockRejectedValueOnce(new GraphError("(#10) Outside of allowed window", false));
        await expect(reply()).rejects.toMatchObject({ statusCode: 502, code: "SEND_FAILED", message: "Instagram refused the message: (#10) Outside of allowed window" });

        expect(mockDb.message.create).not.toHaveBeenCalled();
        expect(mockDb.message.update).not.toHaveBeenCalled();
    });
});
