import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => ({
    init: vi.fn(),
    isInitialized: vi.fn(() => false),
    instrumentOpenAiClient: vi.fn((client: object) => ({ wrapped: "openai", client })),
    instrumentAnthropicAiClient: vi.fn((client: object) => ({ wrapped: "anthropic", client })),
    onUnhandledRejectionIntegration: vi.fn((options: { mode: string }) => ({ name: "OnUnhandledRejection", options })),
    setupFastifyErrorHandler: vi.fn(),
    captureException: vi.fn(),
}));

vi.mock("@sentry/node", () => sentryMock);

import { initSentry, instrumentAnthropic, instrumentOpenAI, redactText, scrubBreadcrumb, scrubEvent, setupSentryFastify } from "@/lib/sentry";

const DSN = "https://public@o0.ingest.sentry.io/0";

function initOptions() {
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    return sentryMock.init.mock.calls[0]![0];
}

beforeEach(() => {
    vi.clearAllMocks();
    sentryMock.isInitialized.mockReturnValue(false);
});

describe("initSentry", () => {
    it("is a no-op without a DSN", () => {
        expect(initSentry({})).toBe(false);
        expect(initSentry({ SENTRY_DSN: "   " })).toBe(false);
        expect(sentryMock.init).not.toHaveBeenCalled();
    });

    it("initialises metadata-only with a DSN", () => {
        expect(initSentry({ SENTRY_DSN: DSN, NODE_ENV: "production" })).toBe(true);
        const options = initOptions();
        expect(options).toMatchObject({
            dsn: DSN,
            environment: "production",
            tracesSampleRate: 0.1,
            sendDefaultPii: false,
            registerEsmLoaderHooks: false,
            beforeSend: scrubEvent,
            beforeSendTransaction: scrubEvent,
            beforeBreadcrumb: scrubBreadcrumb,
        });
        expect(options).not.toHaveProperty("dataCollection");
    });

    it("honours a valid SENTRY_TRACES_SAMPLE_RATE and falls back on a bad one", () => {
        initSentry({ SENTRY_DSN: DSN, SENTRY_TRACES_SAMPLE_RATE: "0.5" });
        expect(initOptions().tracesSampleRate).toBe(0.5);
        vi.clearAllMocks();
        initSentry({ SENTRY_DSN: DSN, SENTRY_TRACES_SAMPLE_RATE: "7" });
        expect(initOptions().tracesSampleRate).toBe(0.1);
    });

    it("drops the OpenAI/Anthropic auto-integrations and keeps unhandled rejections fatal", () => {
        initSentry({ SENTRY_DSN: DSN });
        const defaults = ["Http", "OpenAI", "Anthropic_AI", "OnUnhandledRejection", "Fastify"].map((name) => ({ name }));
        const integrations = initOptions().integrations(defaults);
        const names = integrations.map((integration: { name: string }) => integration.name);
        expect(names).toEqual(["Http", "Fastify", "OnUnhandledRejection"]);
        expect(sentryMock.onUnhandledRejectionIntegration).toHaveBeenCalledWith({ mode: "strict" });
    });

    it("never throws when the SDK fails to initialise", () => {
        sentryMock.init.mockImplementationOnce(() => {
            throw new Error("boom");
        });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(initSentry({ SENTRY_DSN: DSN })).toBe(false);
        consoleError.mockRestore();
    });
});

describe("scrubbing personal data from events", () => {
    const SECRET = "x".repeat(20) + "Y".repeat(20);
    const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

    it("redacts emails, phone numbers, tokens and query strings from free text", () => {
        const text = redactText(
            `send to jane.doe@example.com / +91 98765 43210 failed: Bearer abc.def-ghi key ${SECRET} jwt ${JWT} ` +
                `at https://api.example.com/v1/verify?token=abc&email=jane%40example.com and /invite?code=XYZ123`,
        );
        expect(text).not.toMatch(/jane|98765|abc\.def|XYZ123|eyJ/);
        expect(text).not.toContain(SECRET);
        expect(text).toContain("[email]");
        expect(text).toContain("[phone]");
        expect(text).toContain("Bearer [redacted]");
        expect(text).toContain("https://api.example.com/v1/verify?[redacted]");
        expect(text).toContain("/invite?code=[redacted]");
    });

    it("leaves ids, UUIDs and timestamps readable", () => {
        const text = "lead 3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b team cmf4x2k9a0001abcd at 2026-10-26T10:00:00.000Z (1793000000000) status 503";
        expect(redactText(text)).toBe(text);
    });

    it("scrubs the message, exception text, frame variables, extras, tags and breadcrumbs of an event", () => {
        const event = scrubEvent({
            message: "Lead jane@example.com bounced",
            request: { method: "POST", url: "https://x.test/api/leads?email=jane@example.com", headers: { cookie: "s=1" }, data: "{}" },
            exception: { values: [{ type: "Error", value: "Duplicate +1 415 555 0100", stacktrace: { frames: [{ function: "f", vars: { lead: { email: "jane@example.com" } } }] } }] },
            extra: { lead: { email: "jane@example.com", attempts: 2 } },
            tags: { recipient: "jane@example.com", route: "/api/leads" },
            breadcrumbs: [{ category: "http", message: "GET https://x.test/a?token=abc", data: { url: "https://x.test/a?token=abc", from: "/invite?code=1" } }],
        } as any) as any;
        expect(JSON.stringify(event)).not.toMatch(/jane|415 555|token=abc|code=1|cookie/);
        expect(event.request).toEqual({ method: "POST", url: "https://x.test/api/leads" });
        expect(event.exception.values[0].stacktrace.frames[0]).toEqual({ function: "f" });
        expect(event.extra.lead.attempts).toBe(2);
        expect(event.tags.route).toBe("/api/leads");
        expect(event.breadcrumbs[0].data).toEqual({ url: "https://x.test/a", from: "/invite" });
    });

    it("drops console breadcrumbs and scrubs the rest", () => {
        expect(scrubBreadcrumb({ category: "console", message: "jane@example.com" })).toBeNull();
        expect(scrubBreadcrumb({ category: "fetch", message: "to jane@example.com", data: { url: "/api/x?key=1" } })).toEqual({
            category: "fetch",
            message: "to [email]",
            data: { url: "/api/x" },
        });
    });
});

describe("AI client wrappers", () => {
    it("wrap OpenAI and Anthropic clients with inputs/outputs recording off", () => {
        sentryMock.isInitialized.mockReturnValue(true);
        const openai = {};
        const anthropic = {};
        expect(instrumentOpenAI(openai)).toEqual({ wrapped: "openai", client: openai });
        expect(instrumentAnthropic(anthropic)).toEqual({ wrapped: "anthropic", client: anthropic });
        expect(sentryMock.instrumentOpenAiClient).toHaveBeenCalledWith(openai, { recordInputs: false, recordOutputs: false });
        expect(sentryMock.instrumentAnthropicAiClient).toHaveBeenCalledWith(anthropic, { recordInputs: false, recordOutputs: false });
    });

    it("return the raw client untouched while Sentry is not initialised", () => {
        const client = {};
        expect(instrumentOpenAI(client)).toBe(client);
        expect(instrumentAnthropic(client)).toBe(client);
        expect(sentryMock.instrumentOpenAiClient).not.toHaveBeenCalled();
        expect(sentryMock.instrumentAnthropicAiClient).not.toHaveBeenCalled();
    });
});

describe("setupSentryFastify", () => {
    it("registers the Fastify error handler only when Sentry is active", () => {
        const app = {} as never;
        setupSentryFastify(app);
        expect(sentryMock.setupFastifyErrorHandler).not.toHaveBeenCalled();
        sentryMock.isInitialized.mockReturnValue(true);
        setupSentryFastify(app);
        expect(sentryMock.setupFastifyErrorHandler).toHaveBeenCalledWith(app);
    });
});

describe("structural guard: every OpenAI/Anthropic client is Sentry-wrapped", () => {
    const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

    function sourceFiles(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                return ["node_modules", "__tests__", "dist", "tmp"].includes(entry.name) ? [] : sourceFiles(full);
            }
            return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
        });
    }

    it("wraps each `new OpenAI(` / `new Anthropic(` directly in instrumentOpenAI / instrumentAnthropic", () => {
        const sites: string[] = [];
        const unwrapped: string[] = [];
        for (const file of sourceFiles(apiRoot)) {
            const source = fs.readFileSync(file, "utf8");
            for (const match of source.matchAll(/new\s+(OpenAI|Anthropic)\s*\(/g)) {
                const line = source.slice(0, match.index).split("\n").length;
                const site = `${path.relative(apiRoot, file)}:${line}`;
                sites.push(site);
                const wrapper = match[1] === "OpenAI" ? "instrumentOpenAI" : "instrumentAnthropic";
                const before = source.slice(0, match.index).trimEnd();
                if (!before.endsWith(`${wrapper}(`)) unwrapped.push(site);
            }
        }
        // 3 OpenAI + 3 Anthropic today; guards against a bad glob silently matching nothing.
        expect(sites.length).toBeGreaterThanOrEqual(6);
        expect(unwrapped).toEqual([]);
    });
});
