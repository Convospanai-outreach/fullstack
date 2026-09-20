import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { meetsAdminLevel } from "@/lib/admin";

// Direct coverage of the role-comparison gate (roadmap.md item 2.7 / S-05).
// The per-route tests mock @/lib/admin, so this is the only place the actual
// comparison is exercised.
describe("meetsAdminLevel", () => {
    it("rejects ORG_ADMIN when SYSTEM_ADMIN is required (the S-05 fix)", () => {
        expect(meetsAdminLevel(UserRole.ORG_ADMIN, UserRole.SYSTEM_ADMIN)).toBe(false);
    });

    it("accepts ORG_ADMIN when ORG_ADMIN is explicitly required", () => {
        expect(meetsAdminLevel(UserRole.ORG_ADMIN, UserRole.ORG_ADMIN)).toBe(true);
    });

    it("accepts SYSTEM_ADMIN and SUPER_ADMIN when SYSTEM_ADMIN is required", () => {
        expect(meetsAdminLevel(UserRole.SYSTEM_ADMIN, UserRole.SYSTEM_ADMIN)).toBe(true);
        expect(meetsAdminLevel(UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN)).toBe(true);
    });

    it("rejects non-admin roles against any admin requirement", () => {
        expect(meetsAdminLevel(UserRole.SALES_USER, UserRole.ORG_ADMIN)).toBe(false);
        expect(meetsAdminLevel(UserRole.VIEWER, UserRole.SYSTEM_ADMIN)).toBe(false);
    });

    it("treats an unknown role as level 0 (denied)", () => {
        expect(meetsAdminLevel("NOT_A_ROLE", UserRole.ORG_ADMIN)).toBe(false);
    });
});
