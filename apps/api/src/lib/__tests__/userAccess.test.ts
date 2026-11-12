import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique } } }));

import { forgetUserAccess, getUserAccess, isFreshAccessRoute, sessionVersionMatches } from "../userAccess";

describe("userAccess", () => {
    beforeEach(() => {
        findUnique.mockReset();
    });

    it("reads suspension and session version, then serves them from cache", async () => {
        findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 4 });
        expect(await getUserAccess("u-1")).toEqual({ suspended: true, sessionVersion: 4 });
        expect(await getUserAccess("u-1")).toEqual({ suspended: true, sessionVersion: 4 });
        expect(findUnique).toHaveBeenCalledTimes(1);

        forgetUserAccess("u-1");
        findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 5 });
        expect(await getUserAccess("u-1")).toEqual({ suspended: false, sessionVersion: 5 });
    });

    it("bypassCache reads the database even when an entry is cached, and refreshes it", async () => {
        findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 1 });
        expect((await getUserAccess("u-bypass")).suspended).toBe(false);
        findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 1 });
        expect((await getUserAccess("u-bypass")).suspended).toBe(false); // still the cached value
        expect((await getUserAccess("u-bypass", { bypassCache: true })).suspended).toBe(true);
        expect((await getUserAccess("u-bypass")).suspended).toBe(true);
    });

    it("flags billing, checkout and admin paths for a fresh read", () => {
        expect(isFreshAccessRoute("/billing/topup")).toBe(true);
        expect(isFreshAccessRoute("/checkout")).toBe(true);
        expect(isFreshAccessRoute("/admin/super/users")).toBe(true);
        expect(isFreshAccessRoute("/leads")).toBe(false);
        expect(isFreshAccessRoute("/billingx")).toBe(false);
    });

    it("returns null for an unknown user and throws on a DB error", async () => {
        findUnique.mockResolvedValue(null);
        expect(await getUserAccess("u-missing")).toBeNull();
        findUnique.mockRejectedValue(new Error("db down"));
        await expect(getUserAccess("u-error")).rejects.toThrow("db down");
    });

    it("treats a token without a session version as version 0", () => {
        expect(sessionVersionMatches({ suspended: false, sessionVersion: 0 }, undefined)).toBe(true);
        expect(sessionVersionMatches({ suspended: false, sessionVersion: 1 }, undefined)).toBe(false);
        expect(sessionVersionMatches({ suspended: false, sessionVersion: 2 }, 2)).toBe(true);
    });
});
