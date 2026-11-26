import { describe, expect, it, vi } from "vitest";
import { findReplyPlanOwner } from "../replySubsequenceStore";

describe("reply follow-up task ownership", () => {
    it("falls back to an active owner or admin if the campaign owner left", async () => {
        const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ userId: "active-admin" });
        await expect(findReplyPlanOwner({ teamMember: { findFirst } } as never, "team-a", "former-owner")).resolves.toBe("active-admin");
        expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: { teamId: "team-a", status: "active", role: { in: ["owner", "admin"] } },
        }));
    });

    it("returns no assignee when the owner and active admins are missing", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        await expect(findReplyPlanOwner({ teamMember: { findFirst } } as never, "team-a", null)).resolves.toBeNull();
        expect(findFirst).toHaveBeenCalledTimes(1);
    });
});
