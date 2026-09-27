import * as Sentry from "@sentry/node";
import { afterAll, describe, expect, it } from "vitest";
import { initSentry, instrumentAnthropic, instrumentOpenAI } from "@/lib/sentry";

// Real SDK (no mocks): proves what actually leaves the process for a wrapped
// client. Nothing is delivered - the DSN points at a closed local port and every
// envelope is inspected (and serialised) before the transport would send it.
const LEAD_PII = "jane.lead@example.com";

const envelopes: string[] = [];

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

describe("Sentry AI tracing privacy (real SDK)", () => {
    it("records model and token usage but never prompts or completions", async () => {
        expect(initSentry({ SENTRY_DSN: "http://public@127.0.0.1:9/1", SENTRY_TRACES_SAMPLE_RATE: "1" })).toBe(true);
        Sentry.getClient()!.on("beforeEnvelope", (envelope) => {
            envelopes.push(JSON.stringify(envelope));
        });

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
});
