import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-07T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const mockDb: any = vi.hoisted(() => ({
    dmFlow: { findFirst: vi.fn() },
    dmFlowRun: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    dmFlowEvent: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    socialAccount: { findFirst: vi.fn() },
    socialContact: { findFirst: vi.fn() },
    keywordTrigger: { findFirst: vi.fn() },
    keywordTriggerReply: { create: vi.fn() },
    landingPage: { findFirst: vi.fn() },
    lead: { findUnique: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
}));
const sendMessageRequest = vi.hoisted(() => vi.fn());
const pageTokenFor = vi.hoisted(() => vi.fn());
const findOrCreateContact = vi.hoisted(() => vi.fn());
const isCreatorFunnelEnabled = vi.hoisted(() => vi.fn());
const signLinkToken = vi.hoisted(() => vi.fn());
const enforceOptOut = vi.hoisted(() => vi.fn());
const saveLandingAnswersToLead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled }));
vi.mock("../linkToken", () => ({ signLinkToken }));
vi.mock("../socialInbox", async (importOriginal) => ({ ...(await importOriginal<typeof import("../socialInbox")>()), pageTokenFor, findOrCreateContact }));
vi.mock("../keywordTriggers", async (importOriginal) => ({ ...(await importOriginal<typeof import("../keywordTriggers")>()), sendMessageRequest }));
vi.mock("@/modules/governance/ComplianceGuard", () => ({ complianceGuard: { enforceOptOut } }));
vi.mock("@/modules/lead-properties/leadCustomFields", () => ({ saveLandingAnswersToLead }));

import { processPendingFlowEvents, queueFlowInbound, queueFlowStart } from "../dmFlowRuns";
import { GraphError } from "../metaGraph";
import type { FlowStep } from "../dmFlowMachine";

const account = {
    id: "acc-ig",
    teamId: "team-a",
    platform: "INSTAGRAM",
    externalId: "17841",
    parentExternalId: null,
    handle: "brand",
    status: "CONNECTED",
    scopes: ["instagram_business_manage_messages"],
    encryptedToken: { plain: "tok" },
};
const trigger = { id: "trg-1", flowId: "flow-1", landingPageId: null };
const questionSteps: FlowStep[] = [{ type: "message", text: "One" }, { type: "message", text: "Two" }, { type: "question", text: "What is your budget?", property: "budget" }, { type: "end" }];

const run = (over: Record<string, unknown> = {}) => ({
    id: "run-1",
    teamId: "team-a",
    flowId: "flow-1",
    socialAccountId: "acc-ig",
    personKey: "ig-user-1",
    leadId: "lead-1",
    steps: questionSteps,
    stepIndex: 0,
    awaitingAnswer: false,
    status: "ACTIVE",
    waitingSince: null,
    lastInboundAt: null,
    version: 0,
    updatedAt: NOW,
    ...over,
});
const event = (sourceKey: string, over: Record<string, unknown> = {}) => ({ id: "ev-1", runId: "run-1", sourceKey, kind: "PENDING", createdAt: NOW, ...over });

beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
    mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", steps: questionSteps });
    mockDb.dmFlowRun.create.mockResolvedValue({ id: "run-1" });
    mockDb.dmFlowRun.updateMany.mockResolvedValue({ count: 1 });
    mockDb.dmFlowEvent.create.mockResolvedValue({});
    mockDb.dmFlowEvent.updateMany.mockResolvedValue({ count: 1 });
    mockDb.dmFlowEvent.count.mockResolvedValue(0);
    mockDb.dmFlowEvent.findMany.mockResolvedValue([]);
    mockDb.socialAccount.findFirst.mockResolvedValue(account);
    mockDb.keywordTrigger.findFirst.mockResolvedValue({ id: "trg-1", landingPageId: null, active: true });
    mockDb.lead.findUnique.mockResolvedValue({ status: "NEW" });
    mockDb.message.findFirst.mockResolvedValue({ content: "hello", createdAt: NOW });
    mockDb.message.create.mockResolvedValue({ id: "msg-1" });
    mockDb.keywordTriggerReply.create.mockResolvedValue({ id: "rep-1" });
    pageTokenFor.mockResolvedValue("tok");
    isCreatorFunnelEnabled.mockResolvedValue(true);
    sendMessageRequest.mockResolvedValue({ message_id: "m-1", recipient_id: "ig-user-1" });
    signLinkToken.mockReturnValue("tok123");
    saveLandingAnswersToLead.mockResolvedValue(undefined);
});

describe("queueFlowStart", () => {
    it("starts a run for a new person and queues a start event for the comment", async () => {
        mockDb.dmFlowRun.findUnique.mockResolvedValue(null);
        const started = await queueFlowStart(account as any, trigger, { sourceKey: "comment:c-1", personKey: "ig-user-1" }, NOW);
        expect(started).toBe(true);
        expect(mockDb.dmFlowRun.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-a", flowId: "flow-1", socialAccountId: "acc-ig", personKey: "ig-user-1", steps: questionSteps, status: "ACTIVE", stepIndex: 0 }),
        });
        expect(mockDb.dmFlowEvent.create).toHaveBeenCalledWith({
            data: { runId: "run-1", sourceKey: "start:comment:c-1", kind: "PENDING" },
        });
    });

    it("does not start a second run while the person is still in one", async () => {
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ status: "WAITING" }));
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "comment:c-2", personKey: "ig-user-1" }, NOW)).toBe(false);
        expect(mockDb.dmFlowRun.create).not.toHaveBeenCalled();
    });

    it("a redelivered start that loses the create race queues nothing", async () => {
        mockDb.dmFlowRun.findUnique.mockResolvedValue(null);
        mockDb.dmFlowRun.create.mockRejectedValue(uniqueViolation());
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "comment:c-1", personKey: "ig-user-1" }, NOW)).toBe(false);
        expect(mockDb.dmFlowEvent.create).not.toHaveBeenCalled();
    });

    it("restarts a finished run in place once the 24-hour cooldown has passed", async () => {
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ status: "COMPLETED", version: 3, updatedAt: new Date(NOW.getTime() - 25 * HOUR) }));
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "dm:mid-7", personKey: "ig-user-1" }, NOW)).toBe(true);
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({
            where: { id: "run-1", version: 3 },
            data: expect.objectContaining({ status: "ACTIVE", stepIndex: 0, awaitingAnswer: false, version: { increment: 1 } }),
        });
        expect(mockDb.dmFlowEvent.create).toHaveBeenCalledWith({ data: { runId: "run-1", sourceKey: "start:dm:mid-7", kind: "PENDING" } });
    });

    it("does not restart a finished run inside the cooldown", async () => {
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ status: "COMPLETED", updatedAt: new Date(NOW.getTime() - 2 * HOUR) }));
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "dm:mid-8", personKey: "ig-user-1" }, NOW)).toBe(false);
        expect(mockDb.dmFlowRun.updateMany).not.toHaveBeenCalled();
    });

    it("a flow with a link step needs a landing page on the trigger", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", steps: [{ type: "link", text: "Guide" }, { type: "end" }] });
        mockDb.dmFlowRun.findUnique.mockResolvedValue(null);
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "comment:c-1", personKey: "ig-user-1" }, NOW)).toBe(false);
        expect(mockDb.dmFlowRun.create).not.toHaveBeenCalled();
    });

    it("a missing or archived flow starts nothing", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue(null);
        expect(await queueFlowStart(account as any, trigger, { sourceKey: "comment:c-1", personKey: "ig-user-1" }, NOW)).toBe(false);
        expect(mockDb.dmFlow.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "flow-1", teamId: "team-a", archivedAt: null }) }));
    });
});

describe("queueFlowInbound", () => {
    it("queues one inbound event per run this person has in progress", async () => {
        mockDb.dmFlowRun.findMany.mockResolvedValue([{ id: "run-1" }, { id: "run-2" }]);
        expect(await queueFlowInbound(account as any, { mid: "mid-9", senderId: "ig-user-1" })).toBe(2);
        expect(mockDb.dmFlowRun.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId: "team-a", socialAccountId: "acc-ig", personKey: "ig-user-1", status: { in: ["ACTIVE", "WAITING"] } },
            })
        );
        expect(mockDb.dmFlowEvent.create).toHaveBeenCalledWith({ data: { runId: "run-2", sourceKey: "in:mid-9", kind: "PENDING" } });
    });

    it("a redelivered message is not queued twice", async () => {
        mockDb.dmFlowRun.findMany.mockResolvedValue([{ id: "run-1" }]);
        mockDb.dmFlowEvent.create.mockRejectedValue(uniqueViolation());
        expect(await queueFlowInbound(account as any, { mid: "mid-9", senderId: "ig-user-1" })).toBe(0);
    });
});

describe("processPendingFlowEvents", () => {
    it("a DM start sends each message in order and waits at the question", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-1")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ lastInboundAt: null }));
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest.mock.calls.map((c) => [c[2], c[3], c[4]])).toEqual([
            ["DM", { id: "ig-user-1" }, "One"],
            ["DM", { id: "ig-user-1" }, "Two"],
            ["DM", { id: "ig-user-1" }, "What is your budget?"],
        ]);
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({
            where: { id: "run-1", version: 0 },
            data: expect.objectContaining({ status: "WAITING", stepIndex: 2, awaitingAnswer: true, version: { increment: 1 } }),
        });
        expect(mockDb.dmFlowEvent.updateMany).toHaveBeenCalledWith({ where: { id: "ev-1", kind: "PROCESSING" }, data: { kind: "DONE" } });
    });

    it("a comment start sends only the private reply to the comment, then waits", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:comment:c-1")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest).toHaveBeenCalledTimes(1);
        expect(sendMessageRequest).toHaveBeenCalledWith(expect.objectContaining({ id: "acc-ig" }), "tok", "COMMENT", { comment_id: "c-1" }, "One");
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({
            where: { id: "run-1", version: 0 },
            data: expect.objectContaining({ status: "WAITING", stepIndex: 1 }),
        });
    });

    it("an answer is saved to the property, then the flow continues", async () => {
        const steps: FlowStep[] = [{ type: "question", text: "Budget?", property: "budget" }, { type: "message", text: "Thanks" }, { type: "end" }];
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("in:mid-2")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ steps, awaitingAnswer: true, status: "WAITING", waitingSince: NOW }));
        mockDb.message.findFirst.mockResolvedValue({ content: "5000", createdAt: NOW });
        await processPendingFlowEvents(NOW);
        expect(mockDb.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { externalId: "acc-ig:mid-2" } }));
        expect(saveLandingAnswersToLead).toHaveBeenCalledWith("team-a", "lead-1", { answers: { budget: "5000" } });
        expect(sendMessageRequest).toHaveBeenCalledWith(expect.anything(), "tok", "DM", { id: "ig-user-1" }, "Thanks");
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", version: 0 }, data: expect.objectContaining({ status: "COMPLETED" }) });
    });

    it("a STOP reply marks the lead do-not-contact through the existing opt-out and sends nothing", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("in:mid-3")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ status: "WAITING", awaitingAnswer: true, stepIndex: 2, waitingSince: NOW }));
        mockDb.message.findFirst.mockResolvedValue({ content: "please stop", createdAt: NOW });
        await processPendingFlowEvents(NOW);
        expect(enforceOptOut).toHaveBeenCalledWith("lead-1", expect.any(String));
        expect(sendMessageRequest).not.toHaveBeenCalled();
        expect(saveLandingAnswersToLead).not.toHaveBeenCalled();
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", version: 0 }, data: expect.objectContaining({ status: "STOPPED" }) });
    });

    it("a do-not-contact lead is never messaged", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-4")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        mockDb.lead.findUnique.mockResolvedValue({ status: "DNC" });
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest).not.toHaveBeenCalled();
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", version: 0 }, data: expect.objectContaining({ status: "STOPPED" }) });
    });

    it("the daily cap stops sends to one person", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-5")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        mockDb.dmFlowEvent.count.mockResolvedValue(6);
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest).not.toHaveBeenCalled();
        expect(mockDb.dmFlowEvent.count).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ kind: "SENT", run: { teamId: "team-a", socialAccountId: "acc-ig", personKey: "ig-user-1" } }) })
        );
    });

    it("a refused send ends the run as failed and is not retried", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-6")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        sendMessageRequest.mockRejectedValue(new GraphError("This message is not allowed", false));
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest).toHaveBeenCalledTimes(1);
        expect(mockDb.dmFlowEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ runId: "run-1", kind: "FAILED" }) });
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", version: 0 }, data: expect.objectContaining({ status: "FAILED" }) });
    });

    it("a send Meta did not confirm is recorded as unconfirmed and not retried", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-6b")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        sendMessageRequest.mockRejectedValue(new GraphError("timeout", true));
        await processPendingFlowEvents(NOW);
        expect(mockDb.dmFlowEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "UNCONFIRMED" }) });
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", version: 0 }, data: expect.objectContaining({ status: "FAILED" }) });
    });

    it("a link step sends the landing page with a signed token and records a reply row the sign-up can merge into", async () => {
        mockDb.keywordTrigger.findFirst.mockResolvedValue({ id: "trg-1", landingPageId: "page-1", active: true });
        mockDb.landingPage.findFirst.mockResolvedValue({ slug: "guide" });
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-10")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run({ steps: [{ type: "link", text: "Here is the guide" }, { type: "end" }] }));
        await processPendingFlowEvents(NOW);
        expect(mockDb.keywordTriggerReply.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-a", triggerId: "trg-1", socialAccountId: "acc-ig", sourceKey: "flow:run-1:0", status: "SENT", leadId: "lead-1" }),
        });
        expect(signLinkToken).toHaveBeenCalledWith("rep-1", NOW);
        const text = sendMessageRequest.mock.calls[0][4] as string;
        expect(text.startsWith("Here is the guide\n\n")).toBe(true);
        expect(text).toContain("/p/guide?t=tok123");
    });

    it("a claimed event is not processed twice", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-11")]);
        mockDb.dmFlowEvent.updateMany.mockResolvedValueOnce({ count: 0 });
        await processPendingFlowEvents(NOW);
        expect(mockDb.dmFlowRun.findUnique).not.toHaveBeenCalled();
        expect(sendMessageRequest).not.toHaveBeenCalled();
    });

    it("a flow whose trigger is switched off sends nothing", async () => {
        mockDb.dmFlowEvent.findMany.mockResolvedValue([event("start:dm:mid-12")]);
        mockDb.dmFlowRun.findUnique.mockResolvedValue(run());
        mockDb.keywordTrigger.findFirst.mockResolvedValue(null);
        await processPendingFlowEvents(NOW);
        expect(sendMessageRequest).not.toHaveBeenCalled();
    });

    it("waiting runs past 24 hours are expired", async () => {
        await processPendingFlowEvents(NOW);
        expect(mockDb.dmFlowRun.updateMany).toHaveBeenCalledWith({
            where: { status: "WAITING", waitingSince: { lt: new Date(NOW.getTime() - 24 * HOUR) } },
            data: { status: "EXPIRED", waitingSince: null },
        });
    });
});
