import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
    order: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
    connectedMailbox: { findFirst: vi.fn() },
    message: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

const isCreatorFunnelEnabled = vi.hoisted(() => vi.fn());
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled }));
const applyFunnelEvent = vi.hoisted(() => vi.fn());
vi.mock("../funnelStageService", () => ({ applyFunnelEvent }));
const nurture = vi.hoisted(() => ({ stopNurture: vi.fn(), enrollInNurture: vi.fn() }));
vi.mock("../nurtureProvider", () => nurture);
const mail = vi.hoisted(() => ({ isSuppressed: vi.fn(), sendViaGmailMailbox: vi.fn(), sendViaResendMailbox: vi.fn(), sendViaSmtpMailbox: vi.fn() }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({ isSuppressed: mail.isSuppressed, sendViaGmailMailbox: mail.sendViaGmailMailbox }));
vi.mock("@/modules/email-campaigner/service/resendMailboxService", () => ({ sendViaResendMailbox: mail.sendViaResendMailbox }));
vi.mock("@/modules/email-campaigner/service/smtpConfigService", () => ({ sendViaSmtpMailbox: mail.sendViaSmtpMailbox }));

import { deliveryEmail, onCheckoutStarted, onOrderCaptured, processAbandonedCarts } from "../checkoutHooks";

const NOW = new Date("2026-10-02T12:00:00Z");
const ACTIVATED = new Date("2026-10-01T00:00:00Z");
const HOUR = 60 * 60 * 1000;

const product = (over: Record<string, unknown> = {}) => ({
    name: "Course <Pro>",
    deliveryUrl: "https://school.example/course",
    deliveryMailboxId: "mb-1",
    automationsActive: true,
    automationsActivatedAt: ACTIVATED,
    ...over,
});
const capturedOrder = (over: Record<string, unknown> = {}) => ({
    id: "order-1",
    teamId: "team-a",
    productId: "prod-1",
    status: "CAPTURED",
    customerEmail: "Buyer@Example.com",
    customerName: "Asha <b>",
    leadId: null,
    deliveryStatus: null,
    createdAt: new Date(ACTIVATED.getTime() + HOUR),
    product: product(),
    ...over,
});

describe("checkoutHooks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isCreatorFunnelEnabled.mockResolvedValue(true);
        applyFunnelEvent.mockResolvedValue({ changed: true });
        nurture.stopNurture.mockResolvedValue({ stopped: true });
        mockDb.order.updateMany.mockResolvedValue({ count: 1 });
        mockDb.lead.findFirst.mockResolvedValue(null);
        mockDb.lead.create.mockResolvedValue({ id: "lead-new" });
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mb-1", provider: "GOOGLE_WORKSPACE" });
        mail.isSuppressed.mockResolvedValue(false);
        mail.sendViaGmailMailbox.mockResolvedValue({ success: true, deliveryProvider: "GMAIL_API" });
    });

    describe("checkout started", () => {
        const pending = { id: "order-1", teamId: "team-a", customerEmail: " Buyer@Example.com ", customerName: null, leadId: null };

        it("moves the team's existing lead with that email to BOFU and links it to the order", async () => {
            mockDb.order.findUnique.mockResolvedValue(pending);
            mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1" });
            await onCheckoutStarted("order-1");
            expect(mockDb.lead.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { teamId: "team-a", email: { equals: "buyer@example.com", mode: "insensitive" } } }),
            );
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({ where: { id: "order-1", teamId: "team-a", leadId: null }, data: { leadId: "lead-1" } });
            expect(applyFunnelEvent).toHaveBeenCalledWith("team-a", "lead-1", "checkout_started");
        });

        it("never creates a lead from an unverified checkout email", async () => {
            mockDb.order.findUnique.mockResolvedValue(pending);
            await onCheckoutStarted("order-1");
            expect(mockDb.lead.create).not.toHaveBeenCalled();
            expect(applyFunnelEvent).not.toHaveBeenCalled();
        });

        it("does nothing for teams without the flag", async () => {
            isCreatorFunnelEnabled.mockResolvedValue(false);
            mockDb.order.findUnique.mockResolvedValue(pending);
            await onCheckoutStarted("order-1");
            expect(mockDb.lead.findFirst).not.toHaveBeenCalled();
        });
    });

    describe("order captured", () => {
        it("creates the buyer's lead, moves it to POST, stops nurture and emails the delivery link once", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder());
            await onOrderCaptured("team-a", "order-1");

            expect(mockDb.order.findFirst).toHaveBeenCalledWith({ where: { id: "order-1", teamId: "team-a", status: "CAPTURED" }, include: { product: true } });
            expect(mockDb.lead.create).toHaveBeenCalledWith({
                data: { teamId: "team-a", email: "buyer@example.com", fullName: "Asha <b>", source: "checkout", status: "NEW" },
                select: { id: true },
            });
            expect(applyFunnelEvent).toHaveBeenCalledWith("team-a", "lead-new", "payment_succeeded");
            expect(nurture.stopNurture).toHaveBeenCalledWith("team-a", "lead-new", "purchased");
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({ where: { id: "order-1", teamId: "team-a", deliveryStatus: null }, data: { deliveryStatus: "SENDING" } });
            expect(mail.sendViaGmailMailbox).toHaveBeenCalledTimes(1);
            const sent = mail.sendViaGmailMailbox.mock.calls[0]![0];
            expect(sent).toMatchObject({ teamId: "team-a", mailboxId: "mb-1", to: "buyer@example.com", subject: "Your Course <Pro>" });
            expect(sent.html).toContain("Asha &lt;b&gt;");
            expect(sent.html).toContain("Course &lt;Pro&gt;");
            expect(sent.html).not.toContain("<b>");
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({
                where: { id: "order-1", teamId: "team-a", deliveryStatus: "SENDING" },
                data: { deliveryStatus: "SENT", deliveredAt: expect.any(Date) },
            });
            expect(mockDb.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId: "lead-new", direction: "OUTBOUND", sender: "Delivery" }) });
        });

        it("starts the product's after-purchase sequence only after stopping nurture, and only when switched on", async () => {
            const order: string[] = [];
            nurture.stopNurture.mockImplementation(async () => { order.push("stop"); return { stopped: true }; });
            nurture.enrollInNurture.mockImplementation(async () => { order.push("enroll"); });
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1", product: product({ postPurchaseSequenceId: "seq-post" }) }));
            await onOrderCaptured("team-a", "order-1");
            expect(nurture.enrollInNurture).toHaveBeenCalledWith("team-a", "lead-1", "seq-post");
            expect(order).toEqual(["stop", "enroll"]);

            nurture.enrollInNurture.mockClear();
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1", product: product({ postPurchaseSequenceId: "seq-post", automationsActive: false }) }));
            await onOrderCaptured("team-a", "order-1");
            expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        });

        it("uses the existing lead instead of making a duplicate", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder());
            mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1" });
            await onOrderCaptured("team-a", "order-1");
            expect(mockDb.lead.create).not.toHaveBeenCalled();
            expect(applyFunnelEvent).toHaveBeenCalledWith("team-a", "lead-1", "payment_succeeded");
        });

        it("doesn't send again when the job is replayed (the order is already claimed)", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1" }));
            mockDb.order.updateMany.mockResolvedValue({ count: 0 });
            await onOrderCaptured("team-a", "order-1");
            expect(mail.sendViaGmailMailbox).not.toHaveBeenCalled();
        });

        it("records a failed send and doesn't throw", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1" }));
            mail.sendViaGmailMailbox.mockRejectedValue(new Error("token expired"));
            await expect(onOrderCaptured("team-a", "order-1")).resolves.toBeUndefined();
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({
                where: { id: "order-1", teamId: "team-a", deliveryStatus: "SENDING" },
                data: { deliveryStatus: "FAILED", deliveryError: "token expired" },
            });
        });

        it("skips suppressed buyers and disconnected mailboxes without sending", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1" }));
            mail.isSuppressed.mockResolvedValue(true);
            await onOrderCaptured("team-a", "order-1");
            mail.isSuppressed.mockResolvedValue(false);
            mockDb.connectedMailbox.findFirst.mockResolvedValue(null);
            await onOrderCaptured("team-a", "order-1");
            expect(mail.sendViaGmailMailbox).not.toHaveBeenCalled();
            expect(mockDb.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "SKIPPED" }) }));
            expect(mockDb.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) }));
        });

        it("sends nothing unless the product's automations are on, and only for orders started after that", async () => {
            for (const over of [
                { product: product({ automationsActive: false }) },
                { product: product({ deliveryUrl: null }) },
                { createdAt: new Date(ACTIVATED.getTime() - HOUR) },
            ]) {
                mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1", ...over }));
                await onOrderCaptured("team-a", "order-1");
            }
            expect(mockDb.order.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { deliveryStatus: "SENDING" } }));
            expect(mail.sendViaGmailMailbox).not.toHaveBeenCalled();
            // The stage still moves: that's not an automatic send.
            expect(applyFunnelEvent).toHaveBeenCalledTimes(3);
        });

        it("refuses a non-https delivery link at send time", async () => {
            mockDb.order.findFirst.mockResolvedValue(capturedOrder({ leadId: "lead-1", product: product({ deliveryUrl: "javascript:alert(1)" }) }));
            await onOrderCaptured("team-a", "order-1");
            expect(mail.sendViaGmailMailbox).not.toHaveBeenCalled();
        });

        it("does nothing for teams without the flag", async () => {
            isCreatorFunnelEnabled.mockResolvedValue(false);
            await onOrderCaptured("team-a", "order-1");
            expect(mockDb.order.findFirst).not.toHaveBeenCalled();
        });
    });

    describe("abandoned carts", () => {
        const cart = (over: Record<string, unknown> = {}) => ({
            id: "order-2",
            teamId: "team-a",
            productId: "prod-1",
            leadId: "lead-1",
            createdAt: new Date(NOW.getTime() - 3 * HOUR),
            product: { cartAbandonSequenceId: "seq-1", cartAbandonHours: 2, automationsActivatedAt: ACTIVATED },
            ...over,
        });

        it("hands an unpaid cart past its hours to the cart-abandon sequence once", async () => {
            mockDb.order.findMany.mockResolvedValue([cart()]);
            mockDb.order.findFirst.mockResolvedValue(null);
            await expect(processAbandonedCarts(NOW)).resolves.toEqual({ enrolled: 1 });
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({ where: { id: "order-2", status: "PENDING", abandonHandledAt: null }, data: { abandonHandledAt: NOW } });
            expect(nurture.stopNurture).toHaveBeenCalledWith("team-a", "lead-1", "cart_abandoned");
            expect(nurture.enrollInNurture).toHaveBeenCalledWith("team-a", "lead-1", "seq-1");
        });

        it("leaves carts that aren't due, started before switch-on, or already claimed", async () => {
            mockDb.order.findMany.mockResolvedValue([
                cart({ createdAt: new Date(NOW.getTime() - HOUR) }),
                cart({ createdAt: new Date(ACTIVATED.getTime() - HOUR) }),
            ]);
            await expect(processAbandonedCarts(NOW)).resolves.toEqual({ enrolled: 0 });
            expect(mockDb.order.updateMany).not.toHaveBeenCalled();

            mockDb.order.findMany.mockResolvedValue([cart()]);
            mockDb.order.updateMany.mockResolvedValue({ count: 0 });
            await processAbandonedCarts(NOW);
            expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        });

        it("doesn't chase a lead who has paid for the product since", async () => {
            mockDb.order.findMany.mockResolvedValue([cart()]);
            mockDb.order.findFirst.mockResolvedValue({ id: "order-paid" });
            await processAbandonedCarts(NOW);
            expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        });

        it("only looks at recent unpaid carts on switched-on products with a lead", async () => {
            mockDb.order.findMany.mockResolvedValue([]);
            await processAbandonedCarts(NOW);
            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: "PENDING",
                        abandonHandledAt: null,
                        leadId: { not: null },
                        gatewaySessionId: { not: null },
                        product: { automationsActive: true, cartAbandonSequenceId: { not: null }, cartAbandonHours: { not: null } },
                    }),
                }),
            );
        });
    });

    it("escapes the delivery email's product and buyer names", () => {
        const { html } = deliveryEmail("A & B", "https://x.example/?a=1&b=2", "<script>");
        expect(html).toContain("A &amp; B");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain('href="https://x.example/?a=1&amp;b=2"');
    });
});
