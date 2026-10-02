import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({ order: { create: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("./productService", () => ({ productService: { getActiveById: vi.fn().mockResolvedValue({ id: "prod-1", teamId: "team-a", name: "Course", priceAmount: 5000, currency: "INR" }) } }));
vi.mock("./paymentAccountService", () => ({ paymentAccountService: { getActive: vi.fn().mockResolvedValue({ externalAccountId: "acct_1" }) } }));
const gateways = vi.hoisted(() => ({ createStripeCheckoutSession: vi.fn(), createRazorpayRouteOrder: vi.fn() }));
vi.mock("../gateways/stripeConnect", () => ({ createStripeCheckoutSession: gateways.createStripeCheckoutSession }));
vi.mock("../gateways/razorpayRoute", () => ({ createRazorpayRouteOrder: gateways.createRazorpayRouteOrder }));
const onCheckoutStarted = vi.hoisted(() => vi.fn());
vi.mock("@/modules/creator-funnel/checkoutHooks", () => ({ onCheckoutStarted }));

import { checkoutService } from "./checkoutService";

describe("checkoutService creator funnel hook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.order.create.mockResolvedValue({ id: "order-1" });
        gateways.createStripeCheckoutSession.mockResolvedValue({ sessionId: "cs_1", url: "https://checkout.stripe.com/x" });
        gateways.createRazorpayRouteOrder.mockResolvedValue({ id: "order_rp_1" });
    });

    it("runs once the gateway session is saved, for both gateways", async () => {
        await checkoutService.createSession({ productId: "prod-1", gateway: "STRIPE", customerEmail: "a@b.co" });
        await checkoutService.createSession({ productId: "prod-1", gateway: "RAZORPAY", customerEmail: "a@b.co" });
        expect(onCheckoutStarted).toHaveBeenCalledTimes(2);
        expect(onCheckoutStarted).toHaveBeenCalledWith("order-1");
        expect(mockDb.order.update.mock.invocationCallOrder[0]!).toBeLessThan(onCheckoutStarted.mock.invocationCallOrder[0]!);
    });

    it("stores the checkout page's UTM on the order", async () => {
        await checkoutService.createSession({ productId: "prod-1", gateway: "STRIPE", utmSource: "instagram", utmMedium: "dm", utmContent: "post-1" });
        expect(mockDb.order.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ utmSource: "instagram", utmMedium: "dm", utmCampaign: undefined, utmContent: "post-1" }),
        });
    });

    it("never fails the checkout when the hook throws", async () => {
        onCheckoutStarted.mockRejectedValue(new Error("db down"));
        await expect(checkoutService.createSession({ productId: "prod-1", gateway: "STRIPE" })).resolves.toMatchObject({ orderId: "order-1", url: "https://checkout.stripe.com/x" });
    });

    it("doesn't run for an order the gateway never opened", async () => {
        gateways.createStripeCheckoutSession.mockRejectedValue(new Error("stripe down"));
        await expect(checkoutService.createSession({ productId: "prod-1", gateway: "STRIPE" })).rejects.toThrow("stripe down");
        expect(onCheckoutStarted).not.toHaveBeenCalled();
    });
});
