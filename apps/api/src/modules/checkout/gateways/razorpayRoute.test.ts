import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/razorpay", () => ({ razorpay: { accounts: { create } }, isRazorpayConfigured: true }));

import { createRazorpayLinkedAccount } from "./razorpayRoute";

// The body the Connect Razorpay form sends.
const formBody = {
    email: "owner@example.com",
    phone: "9999999999",
    type: "route",
    legal_business_name: "Acme Traders",
    business_type: "individual",
    contact_name: "Acme Traders",
    profile: { category: "ecommerce", subcategory: "online_gaming" },
};

describe("createRazorpayLinkedAccount", () => {
    beforeEach(() => {
        create.mockReset();
        create.mockResolvedValue({ id: "acc_1", status: "created" });
    });

    it("rejects an empty object before any network call", async () => {
        await expect(createRazorpayLinkedAccount({})).rejects.toMatchObject({ statusCode: 400 });
        expect(create).not.toHaveBeenCalled();
    });

    it("rejects an unknown business type and a malformed PAN", async () => {
        await expect(createRazorpayLinkedAccount({ ...formBody, business_type: "pirate" })).rejects.toThrow(/business_type/);
        await expect(createRazorpayLinkedAccount({ ...formBody, legal_info: { pan: "nope" } })).rejects.toThrow(/legal_info/);
        expect(create).not.toHaveBeenCalled();
    });

    it("forwards what the connect form sends", async () => {
        await expect(createRazorpayLinkedAccount(formBody)).resolves.toEqual({ id: "acc_1", status: "created" });
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.com", type: "route", contact_name: "Acme Traders" }));
    });
});
