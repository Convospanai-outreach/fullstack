import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockSendViaSMTP } = vi.hoisted(() => ({ mockSendViaSMTP: vi.fn() }));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: mockSendViaSMTP }));

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

describe("POST /api/support/contact - SMTP send fails", () => {
    const saved: Record<string, string | undefined> = {};
    const env = { SMTP_HOST: "smtp.test", SMTP_USER: "user", SMTP_PASSWORD: "pw" };

    beforeEach(() => {
        for (const [key, value] of Object.entries(env)) {
            saved[key] = process.env[key];
            process.env[key] = value;
        }
        mockSendViaSMTP.mockResolvedValue({ success: false, error: "Connection timeout" });
    });

    afterEach(() => {
        for (const key of Object.keys(env)) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        vi.restoreAllMocks();
        mockSendViaSMTP.mockReset();
    });

    it("answers 502 and logs the ticket id and transport error, not the visitor's details", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await POST(postRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(502);
        const logged = JSON.stringify(error.mock.calls);
        expect(logged).toContain(data.ticketId);
        expect(logged).toContain("Connection timeout");
        expect(logged).not.toContain("ada@example.com");
        expect(logged).not.toContain("Ada Lovelace");
        expect(logged).not.toContain("Pricing question");
    });
});

describe("POST /api/support/contact - Turnstile", () => {
    const saved: Record<string, string | undefined> = {};
    const env = { SMTP_HOST: "smtp.test", SMTP_USER: "user", SMTP_PASSWORD: "pw", TURNSTILE_SECRET_KEY: "secret" };

    beforeEach(() => {
        for (const [key, value] of Object.entries(env)) {
            saved[key] = process.env[key];
            process.env[key] = value;
        }
        mockSendViaSMTP.mockResolvedValue({ success: true, messageId: "m1" });
    });

    afterEach(() => {
        for (const key of Object.keys(env)) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        mockSendViaSMTP.mockReset();
    });

    function stubSiteverify(success: boolean) {
        const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success }) });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("refuses a submission with no token and sends nothing", async () => {
        const fetchMock = stubSiteverify(true);
        const res = await POST(postRequest(validBody));

        expect(res.status).toBe(403);
        expect((await res.json()).status).toBe("verification_failed");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("refuses a token Cloudflare rejects and sends nothing", async () => {
        stubSiteverify(false);
        const res = await POST(postRequest({ ...validBody, turnstileToken: "bad-token" }));

        expect(res.status).toBe(403);
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("delivers the message when Cloudflare accepts the token", async () => {
        const fetchMock = stubSiteverify(true);
        const res = await POST(postRequest({ ...validBody, turnstileToken: "good-token" }));

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(mockSendViaSMTP).toHaveBeenCalledOnce();
    });
});
