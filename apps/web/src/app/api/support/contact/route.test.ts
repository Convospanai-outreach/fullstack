import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const SMTP_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PASS", "SMTP_FROM_EMAIL"] as const;

function postRequest(body: unknown) {
    return new Request("http://localhost/api/support/contact", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

const validBody = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject: "Pricing question",
    message: "Hello there",
};

describe("POST /api/support/contact - no SMTP configured", () => {
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of SMTP_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of SMTP_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        vi.restoreAllMocks();
    });

    it("fails with 503 instead of reporting the message as queued", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await POST(postRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(503);
        expect(data.success).toBeUndefined();
        expect(data.status).toBe("unavailable");
    });

    it("does not log the submitter's details", async () => {
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        await POST(postRequest(validBody));

        const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls]);
        expect(logged).not.toContain("ada@example.com");
        expect(logged).not.toContain("Ada Lovelace");
        expect(logged).not.toContain("Pricing question");
    });
});
