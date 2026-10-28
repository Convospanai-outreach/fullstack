import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockSendViaSMTP, mockApplyRateLimit } = vi.hoisted(() => ({
    mockSendViaSMTP: vi.fn(),
    mockApplyRateLimit: vi.fn(),
}));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: mockSendViaSMTP }));
vi.mock("@/lib/rateLimit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/rateLimit")>()),
    applyRateLimit: mockApplyRateLimit,
}));

import { POST as supportPost } from "./support/contact/route";
import { POST as contactPost } from "./contact/route";
import { RATE_LIMITS } from "@/lib/rateLimit";

const ENV_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL", "TURNSTILE_SECRET_KEY"] as const;
const body = { name: "Ada Lovelace", email: "ada@example.com", subject: "Pricing question", message: "Hello there" };

function post(url: string, payload: unknown) {
    return new Request(url, { method: "POST", body: JSON.stringify(payload) });
}

const ROUTES = [
    ["/api/support/contact", supportPost],
    ["/api/contact", contactPost],
] as const;

describe.each(ROUTES)("%s protection", (path, handler) => {
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ENV_KEYS) saved[key] = process.env[key];
        process.env["SMTP_HOST"] = "smtp.example.com";
        process.env["SMTP_USER"] = "user";
        process.env["SMTP_PASSWORD"] = "pw";
        process.env["SMTP_FROM_EMAIL"] = "from@example.com";
        delete process.env["TURNSTILE_SECRET_KEY"];
        mockApplyRateLimit.mockReset().mockResolvedValue(null);
        mockSendViaSMTP.mockReset().mockResolvedValue({ success: true });
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        vi.unstubAllGlobals();
    });

    it("uses the shared contact-form limit and sends no email when it is exceeded", async () => {
        mockApplyRateLimit.mockResolvedValue(NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }));

        const res = await handler(post(`http://localhost${path}`, body));

        expect(res.status).toBe(429);
        expect(mockApplyRateLimit.mock.calls[0]?.[1]).toBe(RATE_LIMITS.CONTACT_FORM);
        expect(mockApplyRateLimit.mock.calls[0]?.[2]).toBe("contact-form");
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("allows 5 messages per IP per 10 minutes", () => {
        expect(RATE_LIMITS.CONTACT_FORM).toEqual({ windowMs: 10 * 60 * 1000, maxRequests: 5 });
    });

    it("skips the verification while TURNSTILE_SECRET_KEY is unset", async () => {
        const res = await handler(post(`http://localhost${path}`, body));

        expect(res.status).toBe(200);
        expect(mockSendViaSMTP).toHaveBeenCalledTimes(1);
    });

    it("rejects a missing token once TURNSTILE_SECRET_KEY is set", async () => {
        process.env["TURNSTILE_SECRET_KEY"] = "secret";
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await handler(post(`http://localhost${path}`, body));

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("rejects a token Cloudflare does not accept", async () => {
        process.env["TURNSTILE_SECRET_KEY"] = "secret";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))));

        const res = await handler(post(`http://localhost${path}`, { ...body, turnstileToken: "bad" }));

        expect(res.status).toBe(400);
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("sends the message when Cloudflare accepts the token", async () => {
        process.env["TURNSTILE_SECRET_KEY"] = "secret";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));

        const res = await handler(post(`http://localhost${path}`, { ...body, turnstileToken: "good" }));

        expect(res.status).toBe(200);
        expect(mockSendViaSMTP).toHaveBeenCalledTimes(1);
    });
});
