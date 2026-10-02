import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.hoisted(() => vi.fn());
vi.mock("../../service/checkoutService", () => ({ checkoutService: { createSession } }));

import { POST } from "../session";

const post = (body: unknown) =>
    POST(new Request("http://localhost/checkout/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("POST /checkout/session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createSession.mockResolvedValue({ orderId: "order-1" });
    });

    it("passes the page's UTM through, trimmed and capped, and ignores non-strings", async () => {
        await post({
            productId: "prod-1",
            gateway: "RAZORPAY",
            utmSource: " instagram ",
            utmMedium: "comment",
            utmCampaign: "x".repeat(300),
            utmTerm: 5,
            utmContent: "",
        });
        expect(createSession).toHaveBeenCalledWith(
            expect.objectContaining({
                productId: "prod-1",
                gateway: "RAZORPAY",
                utmSource: "instagram",
                utmMedium: "comment",
                utmCampaign: "x".repeat(200),
                utmTerm: undefined,
                utmContent: undefined,
            }),
        );
    });
});
