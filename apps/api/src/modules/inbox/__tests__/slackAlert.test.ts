import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";

const mockDb: any = vi.hoisted(() => ({
    notificationSettings: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));
const getSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/settings/service/settingsService", () => ({ settingsService: { getSettings } }));

import { hasSlackWebhook, postToSlack, sendSlackAlerts, setSlackWebhook, slackEscape } from "../slackAlert";
import { decryptCredential, encryptCredential } from "@/lib/security/credentialVault";

const HOOK = "https://hooks.slack.com/services/T000/B000/abc123";
const fetchMock = vi.fn();

describe("slackAlert", () => {
    const originalKey = process.env["ENCRYPTION_KEY"];

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockResolvedValue({ ok: true });
    });

    afterEach(() => {
        process.env["ENCRYPTION_KEY"] = originalKey;
        vi.unstubAllGlobals();
    });

    it("escapes Slack control characters", () => {
        expect(slackEscape("<!channel> & <https://evil.test|click>")).toBe("&lt;!channel&gt; &amp; &lt;https://evil.test|click&gt;");
    });

    it("only ever posts to hooks.slack.com, without following redirects", async () => {
        for (const url of ["http://hooks.slack.com/services/x", "https://hooks.slack.com.evil.test/services/x", "https://example.test/services/x"]) {
            expect(await postToSlack(url, "hi"), url).toBe(false);
        }
        expect(fetchMock).not.toHaveBeenCalled();

        expect(await postToSlack(HOOK, "hi")).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(HOOK, expect.objectContaining({ method: "POST", body: JSON.stringify({ text: "hi" }), redirect: "error" }));
    });

    it("stores the webhook encrypted, only after a test post succeeds", async () => {
        expect(await setSlackWebhook("user-1", HOOK)).toBe(true);

        expect(getSettings).toHaveBeenCalledWith("user-1");
        const stored = mockDb.notificationSettings.update.mock.calls[0][0];
        expect(stored.where).toEqual({ userId: "user-1" });
        expect(JSON.stringify(stored.data.slackWebhook)).not.toContain("hooks.slack.com");
        expect(await decryptCredential(stored.data.slackWebhook)).toBe(HOOK);
    });

    it("doesn't store a webhook Slack rejects, and clears without calling Slack", async () => {
        fetchMock.mockResolvedValue({ ok: false });
        expect(await setSlackWebhook("user-1", HOOK)).toBe(false);
        expect(mockDb.notificationSettings.update).not.toHaveBeenCalled();

        fetchMock.mockClear();
        expect(await setSlackWebhook("user-1", null)).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockDb.notificationSettings.update).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { slackWebhook: Prisma.DbNull } });
    });

    it("reports whether a webhook is set", async () => {
        mockDb.notificationSettings.findUnique.mockResolvedValueOnce({ slackWebhook: { v: 1 } }).mockResolvedValueOnce({ slackWebhook: null });
        expect(await hasSlackWebhook("user-1")).toBe(true);
        expect(await hasSlackWebhook("user-1")).toBe(false);
    });

    it("sends to each recipient's webhook and swallows failures", async () => {
        mockDb.notificationSettings.findMany.mockResolvedValue([
            { userId: "user-1", slackWebhook: await encryptCredential(HOOK) },
            { userId: "user-2", slackWebhook: { v: 1, cipher: "bad", iv: "bad", tag: "bad" } },
        ]);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(sendSlackAlerts(["user-1", "user-2", "user-3"], "New reply")).resolves.toBeUndefined();

        expect(mockDb.notificationSettings.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: { in: ["user-1", "user-2", "user-3"] }, slackWebhook: { not: Prisma.DbNull } },
        }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(HOOK, expect.objectContaining({ body: JSON.stringify({ text: "New reply" }) }));
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
