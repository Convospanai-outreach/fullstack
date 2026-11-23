import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { enquiry: { create: vi.fn() } } }));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: vi.fn() }));

import { POST } from "./route";

describe("POST contact: email check", () => {
    const keys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const;
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
        for (const k of keys) saved[k] = process.env[k];
        process.env["SMTP_HOST"] = "smtp.test"; process.env["SMTP_USER"] = "user"; process.env["SMTP_PASSWORD"] = "pw";
    });
    afterEach(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

    it("rejects a huge dotted email quickly instead of grinding on it", async () => {
        const start = performance.now();
        const res = await POST(new Request("http://localhost/api/contact", {
            method: "POST",
            body: JSON.stringify({ name: "Ada", subject: "Hi", message: "Hello", email: "a@" + ".".repeat(60_000) + " " }),
        }) as any);
        expect(res.status).toBe(400);
        expect(performance.now() - start).toBeLessThan(500);
    });
});
