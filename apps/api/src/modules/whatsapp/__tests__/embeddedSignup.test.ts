import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mockWarn, error: vi.fn() } }));

import { exchangeSignupCode, getEmbeddedSignupConfig, subscribeAppToWaba } from "../embeddedSignup";

const CONFIG = { appId: "app-1", configId: "cfg-1", appSecret: "very-secret" };

describe("getEmbeddedSignupConfig", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is null until the app id, configuration id and app secret are all set", () => {
        vi.stubEnv("WHATSAPP_APP_ID", "app-1");
        vi.stubEnv("WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "");
        vi.stubEnv("WHATSAPP_APP_SECRET", "secret");
        expect(getEmbeddedSignupConfig()).toBeNull();
    });

    it("returns the three settings when all exist", () => {
        vi.stubEnv("WHATSAPP_APP_ID", " app-1 ");
        vi.stubEnv("WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "cfg-1");
        vi.stubEnv("WHATSAPP_APP_SECRET", "secret");
        expect(getEmbeddedSignupConfig()).toEqual({ appId: "app-1", configId: "cfg-1", appSecret: "secret" });
    });
});

describe("Graph calls", () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("exchanges the signup code for the business token", async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: "tok" }) });
        const result = await exchangeSignupCode("the-code", CONFIG);

        expect(result).toEqual({ ok: true, accessToken: "tok" });
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain("/oauth/access_token?");
        expect(url).toContain("client_id=app-1");
        expect(url).toContain("code=the-code");
    });

    it("fails without leaking the secret when Meta rejects the code", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
        const result = await exchangeSignupCode("the-code", CONFIG);

        expect(result.ok).toBe(false);
        expect(JSON.stringify(result)).not.toContain("very-secret");
        expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("very-secret");
    });

    it("fails when Meta returns no token", async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
        expect((await exchangeSignupCode("the-code", CONFIG)).ok).toBe(false);
    });

    it("subscribes the app to the account with the customer's token", async () => {
        fetchMock.mockResolvedValue({ ok: true });
        const result = await subscribeAppToWaba("102290129340398", "tok");

        expect(result.ok).toBe(true);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/102290129340398/subscribed_apps");
        expect(fetchMock.mock.calls[0][1].method).toBe("POST");
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    });

    it("reports a failed subscription", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 403 });
        expect((await subscribeAppToWaba("102290129340398", "tok")).ok).toBe(false);
    });
});
