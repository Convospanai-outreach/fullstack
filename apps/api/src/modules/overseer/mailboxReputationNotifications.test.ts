import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send, captureException, db } = vi.hoisted(() => ({
    send: vi.fn(), captureException: vi.fn(),
    db: { user: { findUnique: vi.fn() }, notification: { create: vi.fn() } },
}));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("@/lib/sentry", () => ({ captureException }));
vi.mock("@/lib/db", () => ({ prisma: db }));
const alert = { href: "https://app.example.test/settings/domain-health/sender", action: "Review and fix", key: "incident:warning:0" };

async function dispatch() {
    const { NotificationDispatcher } = await import("@/lib/notifications");
    await NotificationDispatcher.send("owner", "SYSTEM", "Action needed", "Three complaints out of 300 sends.", { teamId: "team" }, alert);
}

describe("mailbox reputation notices", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.stubEnv("RESEND_API_KEY", "test-fixture");
        db.user.findUnique.mockResolvedValue({ email: "owner@example.test", settings: {
            notifications: { emailGlobal: true, emailCampaign: false, emailLeads: false, inAppGlobal: false },
        } });
        send.mockResolvedValue({ data: { id: "notice" } });
    });
    afterEach(() => vi.unstubAllEnvs());

    it("alerts in app and sends an email despite category preferences", async () => {
        await dispatch();
        expect(db.notification.create).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            to: "owner@example.test", subject: "Action needed",
            html: expect.stringContaining("Review and fix"),
        }), { idempotencyKey: "incident:warning:0:owner" });
    });

    it("respects global email opt-out and still creates an in-app notice", async () => {
        db.user.findUnique.mockResolvedValue({ email: "owner@example.test", settings: { notifications: { emailGlobal: false, inAppGlobal: false } } });
        await dispatch();
        expect(send).not.toHaveBeenCalled();
        expect(db.notification.create).toHaveBeenCalledTimes(1);
    });

    it("captures provider rejection and keeps the in-app notice", async () => {
        send.mockResolvedValueOnce({ error: { message: "opaque private provider diagnostic" } });
        await dispatch();
        expect(captureException).toHaveBeenCalledWith(new Error("Mailbox reputation alert: system email was rejected"));
        expect(db.notification.create).toHaveBeenCalledTimes(1);
    });

    it("captures an unavailable system sender", async () => {
        vi.stubEnv("RESEND_API_KEY", undefined);
        await dispatch();
        expect(captureException).toHaveBeenCalledWith(new Error("Mailbox reputation alert: system sender is unavailable"));
        expect(db.notification.create).toHaveBeenCalledTimes(1);
    });
});
