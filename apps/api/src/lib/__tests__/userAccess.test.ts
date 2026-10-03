import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique } } }));

import { forgetUserAccess, getUserAccess, sessionVersionMatches } from "../userAccess";

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
