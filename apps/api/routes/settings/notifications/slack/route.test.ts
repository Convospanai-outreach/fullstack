import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/modules/inbox/slackAlert", () => ({
    hasSlackWebhook: vi.fn().mockResolvedValue(true),
    setSlackWebhook: vi.fn().mockResolvedValue(true),
}));

import { GET, PUT } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { hasSlackWebhook, setSlackWebhook } from "@/modules/inbox/slackAlert";

const HOOK = "https://hooks.slack.com/services/T000/B000/abc123";
const put = (body: unknown) =>
    new NextRequest("http://localhost:3001/settings/notifications/slack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

describe("/settings/notifications/slack", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (setSlackWebhook as any).mockResolvedValue(true);
    });

    it("401s without a user", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: null });

        expect((await GET(new NextRequest("http://localhost:3001/settings/notifications/slack"))).status).toBe(401);
        expect((await PUT(put({ url: HOOK }))).status).toBe(401);
        expect(setSlackWebhook).not.toHaveBeenCalled();
    });

    it("reports connected without returning the URL", async () => {
        const res = await GET(new NextRequest("http://localhost:3001/settings/notifications/slack"));

        expect(hasSlackWebhook).toHaveBeenCalledWith("user-1");
        expect(await res.json()).toEqual({ connected: true });
    });

    it("saves and clears the caller's webhook", async () => {
        const saved = await PUT(put({ url: HOOK }));
        expect(await saved.json()).toEqual({ connected: true });
        expect(setSlackWebhook).toHaveBeenCalledWith("user-1", HOOK);

        const cleared = await PUT(put({ url: null }));
        expect(await cleared.json()).toEqual({ connected: false });
        expect(setSlackWebhook).toHaveBeenCalledWith("user-1", null);
    });

    it("rejects anything that isn't a Slack incoming-webhook URL", async () => {
        for (const url of ["http://hooks.slack.com/services/x", "https://hooks.slack.com.evil.test/services/x", "https://hooks.slack.com/workflows/x", "https://example.test", ""]) {
            expect((await PUT(put({ url }))).status, url).toBe(400);
        }
        expect(setSlackWebhook).not.toHaveBeenCalled();
    });

    it("400s when Slack rejects the test post", async () => {
        (setSlackWebhook as any).mockResolvedValue(false);

        expect((await PUT(put({ url: HOOK }))).status).toBe(400);
    });
});
