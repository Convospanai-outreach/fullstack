import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({ team: { findUnique: vi.fn() } }));
const getTeamWabaConfig = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("../wabaCredentials", () => ({ GRAPH_VERSION: "v26.0", getTeamWabaConfig }));

import { checkTemplate, templateShape, templateValues, whatsappRecipient } from "../whatsappTemplates";

const body = (text: string) => ({ type: "BODY", text });
const fetchMock = vi.fn();
const originalFetch = global.fetch;

describe("whatsappTemplates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = fetchMock as any;
        getTeamWabaConfig.mockResolvedValue({ phoneNumberId: "pn-1", accessToken: "token-1" });
        mockDb.team.findUnique.mockResolvedValue({ whatsappBusinessAccountId: "1029" });
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("counts numbered body variables and refuses what can't be sent as body text", () => {
        expect(templateShape({ components: [body("Hi {{1}}, your {{2}} is ready. {{1}}")] })).toEqual({ ok: true, variables: 2 });
        expect(templateShape({ components: [body("No variables")] })).toEqual({ ok: true, variables: 0 });
        expect(templateShape({ components: [body("Hi {{first_name}}")] })).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_UNSUPPORTED" });
        expect(templateShape({ components: [{ type: "HEADER", format: "IMAGE" }, body("x")] })).toMatchObject({ ok: false });
        expect(templateShape({ components: [{ type: "HEADER", format: "TEXT", text: "Hi {{1}}" }, body("x")] })).toMatchObject({ ok: false });
        expect(templateShape({ components: [body("x"), { type: "BUTTONS", buttons: [{ type: "URL", url: "https://x.test/{{1}}" }] }] })).toMatchObject({ ok: false });
        expect(templateShape({ components: [{ type: "HEADER", format: "TEXT", text: "Hello" }, body("x {{1}}"), { type: "BUTTONS", buttons: [{ type: "URL", url: "https://x.test" }] }] }))
            .toEqual({ ok: true, variables: 1 });
    });

    describe("checkTemplate", () => {
        const reply = (data: unknown[], ok = true) => fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 403, json: async () => ({ data }) });

        it("finds the approved template by exact name and language on the team's account", async () => {
            reply([
                { name: "guide_ready_v2", language: "en_US", status: "APPROVED", components: [body("x")] },
                { name: "guide_ready", language: "hi", status: "APPROVED", components: [body("x")] },
                { name: "guide_ready", language: "en_US", status: "APPROVED", components: [body("Hi {{1}}")] },
            ]);
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toEqual({ ok: true, variables: 1 });
            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe("https://graph.facebook.com/v26.0/1029/message_templates?name=guide_ready&fields=name%2Clanguage%2Cstatus%2Ccomponents&limit=100");
            expect(init.headers).toEqual({ Authorization: "Bearer token-1" });
        });

        it("explains what's missing", async () => {
            reply([{ name: "guide_ready", language: "en_US", status: "PENDING", components: [] }]);
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
            reply([]);
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_FOUND" });
            reply([], false);
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_LOOKUP_FAILED" });
            mockDb.team.findUnique.mockResolvedValue({ whatsappBusinessAccountId: null });
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toMatchObject({ ok: false, code: "WHATSAPP_NO_WABA_ID" });
            getTeamWabaConfig.mockResolvedValue(null);
            expect(await checkTemplate("team-a", "guide_ready", "en_US")).toMatchObject({ ok: false, code: "WHATSAPP_NOT_CONNECTED" });
        });
    });

    it("fills {first_name}, falls back for @handles and blanks, and cleans each value to one line", () => {
        expect(templateValues("{first_name}\nyour  guide\t is\r\n\n here", { fullName: "Asha Rao" })).toEqual(["Asha", "your guide is", "here"]);
        expect(templateValues("Hi {First_Name}", { fullName: "@asha.cooks" })).toEqual(["Hi there"]);
        expect(templateValues("{first_name}", { fullName: null })).toEqual(["there"]);
        expect(templateValues(null, {})).toEqual([]);
        expect(templateValues("x".repeat(2000), {})[0]).toHaveLength(1024);
    });

    it("only dials numbers stored with a country code", () => {
        expect(whatsappRecipient("+91 98765 43210")).toBe("919876543210");
        expect(whatsappRecipient("0044 7700 900123")).toBe("447700900123");
        expect(whatsappRecipient("919876543210")).toBe("919876543210");
        expect(whatsappRecipient("98765 43210")).toBeNull();
        expect(whatsappRecipient("+12")).toBeNull();
        expect(whatsappRecipient(null)).toBeNull();
    });
});
