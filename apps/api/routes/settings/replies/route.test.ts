import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), permission: vi.fn(), findTeam: vi.fn(), update: vi.fn(), pause: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mocks.context }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mocks.permission, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/lib/db", () => ({ prisma: { team: { findUnique: mocks.findTeam }, $executeRaw: mocks.update } }));
vi.mock("@/modules/inbox/replySubsequenceService", () => ({ pauseTeamReplySubsequences: mocks.pause }));

import { GET, PUT } from "./route";

const url = "http://localhost/settings/replies";
const request = (body: unknown) => new NextRequest(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("Reply and Follow-up Settings API", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.context.mockResolvedValue({ teamId: "team-a", userId: "rep-a" });
        mocks.findTeam.mockResolvedValue({ sendSafety: { accountReplyCooldownHours: 48 } });
        mocks.permission.mockResolvedValue(true);
        mocks.update.mockResolvedValue(1);
    });

    it("returns safe opt-in defaults and marks settings read-only for a non-admin", async () => {
        mocks.permission.mockResolvedValue(false);
        const response = await GET(new NextRequest(url));
        expect(await response.json()).toMatchObject({ canEdit: false, settings: { followUpPlans: false, maxSteps: 4, approvalHours: 72 } });
    });

    it("ignores unknown read fields and warns on malformed saved limits", async () => {
        mocks.findTeam.mockResolvedValueOnce({ sendSafety: { replyFlow: { futureKey: true, scheduledReplies: true } } });
        expect(await (await GET(new NextRequest(url))).json()).toMatchObject({ invalid: false, settings: { scheduledReplies: true } });
        mocks.findTeam.mockResolvedValueOnce({ sendSafety: { replyFlow: { minSpacingHours: 700 } } });
        expect(await (await GET(new NextRequest(url))).json()).toMatchObject({ invalid: true, settings: { scheduledReplies: false, followUpPlans: false } });
    });

    it("validates stricter limits and denies non-admin writes", async () => {
        for (const input of [{ maxSteps: 5 }, { minSpacingHours: 23 }, { approvalHours: 73 }, { autoPause: { holdHours: 25 } }]) {
            expect((await PUT(request(input))).status).toBe(400);
        }
        mocks.permission.mockResolvedValue(false);
        expect((await PUT(request({ followUpPlans: true }))).status).toBe(403);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("updates only JSON paths owned by reply settings and pauses active plans when disabled", async () => {
        expect((await PUT(request({ followUpPlans: false }))).status).toBe(200);
        const [sql, windowA, windowB, settings, teamId] = mocks.update.mock.calls[0]!;
        expect(sql.join(" ")).toContain("'{replyFlow}'");
        expect(sql.join(" ")).toContain('THEN "sendSafety"');
        expect([windowA, windowB, teamId]).toEqual([null, null, "team-a"]);
        expect(JSON.parse(settings)).toMatchObject({ followUpPlans: false });
        expect(JSON.parse(settings)).not.toHaveProperty("accountReplyCooldownHours");
        expect(mocks.pause).toHaveBeenCalledWith("team-a");
    });
});
