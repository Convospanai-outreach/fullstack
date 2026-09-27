import http from "node:http";
import type { AddressInfo } from "node:net";
import * as Sentry from "@sentry/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureException, initSentry, instrumentAnthropic, instrumentOpenAI } from "@/lib/sentry";

// Real SDK (no mocks): proves what actually leaves the process. Nothing is
// delivered - the DSN points at a closed local port and every envelope is
// inspected (and serialised) before the transport would send it.
const LEAD_PII = "jane.lead@example.com";

const envelopes: string[] = [];

beforeAll(() => {
    expect(initSentry({ SENTRY_DSN: "http://public@127.0.0.1:9/1", SENTRY_TRACES_SAMPLE_RATE: "1" })).toBe(true);
    Sentry.getClient()!.on("beforeEnvelope", (envelope) => {
        envelopes.push(JSON.stringify(envelope));
    });
});

afterAll(async () => {
    await Sentry.close(0);
});

function fakeOpenAI() {
    return {
        chat: {
            completions: {
                create: async (_params: unknown) => ({
                    id: "chatcmpl-1",
                    model: "gpt-4o-mini",
                    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: `Hi ${LEAD_PII}` } }],
                    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
                }),
            },
        },
    };
}

function fakeAnthropic() {
    return {
        messages: {
            create: async (_params: unknown) => ({
                id: "msg_1",
                type: "message",
                role: "assistant",
                model: "claude-sonnet-4-5",
                stop_reason: "end_turn",
                content: [{ type: "text", text: `Hi ${LEAD_PII}` }],
                usage: { input_tokens: 13, output_tokens: 5 },
            }),
        },
    };
}

describe("Sentry privacy (real SDK)", () => {
    it("records model and token usage but never prompts or completions", async () => {
        envelopes.length = 0;
        const openai = instrumentOpenAI(fakeOpenAI());
        const anthropic = instrumentAnthropic(fakeAnthropic());

        await Sentry.startSpan({ name: "test-root", op: "test" }, async () => {
            await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `Draft for ${LEAD_PII}` },
                    { role: "user", content: `Write to ${LEAD_PII}` },
                ],
            });
            await anthropic.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 100,
                system: `Draft for ${LEAD_PII}`,
                messages: [{ role: "user", content: `Write to ${LEAD_PII}` }],
            });
        });
        await Sentry.flush(2000);

        const sent = envelopes.join("\n");
        // Metadata is there...
        expect(sent).toContain("gen_ai.chat");
        expect(sent).toContain("gpt-4o-mini");
        expect(sent).toContain("claude-sonnet-4-5");
        expect(sent).toContain("gen_ai.usage.input_tokens");
        // ...but no prompt, system prompt, or completion text.
        expect(sent).not.toContain(LEAD_PII);
        expect(sent).not.toContain("gen_ai.input.messages");
        expect(sent).not.toContain("gen_ai.system_instructions");
        expect(sent).not.toContain("gen_ai.response.text");
    });

    it("strips request headers, cookies, client IPs and query strings from errors and transactions", async () => {
        envelopes.length = 0;
        // Built at runtime so the values can't reach an envelope via captured
        // source-context lines of this file.
        const secret = (label: string) => `${label}-${process.pid}-${Date.now()}`;
        const sensitive = {
            authz: secret("authz"),
            cookie: secret("cookie"),
            apiKey: secret("apikey"),
            hmac: secret("hmac"),
            operator: `${secret("op")}@example.com`,
            razorpay: secret("razorpay"),
            ip: ["203", "0", "113", String(process.pid % 250)].join("."),
            leadEmail: `${secret("lead")}@example.com`,
        };

        const server = http.createServer((_req, res) => {
            captureException(new Error("handler failure"));
            res.end("ok");
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const { port } = server.address() as AddressInfo;
        await fetch(`http://127.0.0.1:${port}/leads/search?email=${encodeURIComponent(sensitive.leadEmail)}`, {
            headers: {
                authorization: `Bearer ${sensitive.authz}`,
                cookie: `next-auth.session-token=${sensitive.cookie}`,
                "x-api-key": sensitive.apiKey,
                "x-craftmyfunnel-auth-signature": sensitive.hmac,
                "x-craftmyfunnel-user-email": sensitive.operator,
                "x-razorpay-signature": sensitive.razorpay,
                "x-forwarded-for": sensitive.ip,
            },
        });
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await Sentry.flush(2000);

        const sent = envelopes.join("\n");
        expect(sent).toContain("handler failure");
        expect(sent).toContain("/leads/search");
        for (const value of Object.values(sensitive)) {
            expect(sent).not.toContain(value);
            expect(sent).not.toContain(encodeURIComponent(value));
        }
    });
});
