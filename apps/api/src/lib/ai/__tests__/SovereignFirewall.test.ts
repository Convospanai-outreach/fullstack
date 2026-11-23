import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: { post: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")) } }));
vi.mock("@/modules/identity/IdentityService", () => ({ IdentityService: {} }));

import axios from "axios";
import { SovereignFirewall } from "../SovereignFirewall";

const post = vi.mocked(axios.post);
const ENDPOINT_ENVS = ["EDGE_NODE_URI", "EDGE_NODE_URL", "ON_PREM_AI_ENDPOINT", "PHI3_LOCAL_ENDPOINT", "EDGE_API_KEY", "STRICT_SOVEREIGNTY"];
const clearEdgeEnv = () => {
    for (const k of ENDPOINT_ENVS) delete process.env[k];
    (SovereignFirewall as any).breaker.reset();
};

const TEXT = "Call me on +91 98765 43210 or write to jane.doe@acme.com, thanks";

describe("SovereignFirewall.mask when the Edge Node is unavailable", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        delete process.env["STRICT_SOVEREIGNTY"];
    });
    afterEach(() => vi.restoreAllMocks());

    it("passes text through unchanged by default (existing behaviour for other callers)", async () => {
        const { safeContext } = await SovereignFirewall.mask(TEXT);
        expect(safeContext).toBe(TEXT);
    });

    it("masks emails and phone numbers locally with alwaysMask, and can restore them", async () => {
        const { safeContext, tokenMap } = await SovereignFirewall.mask(TEXT, "GLOBAL", undefined, { alwaysMask: true });

        expect(safeContext).not.toContain("jane.doe@acme.com");
        expect(safeContext).not.toContain("98765 43210");
        expect(safeContext).toContain("thanks");
        expect(SovereignFirewall.unmask(safeContext, tokenMap)).toBe(TEXT);
    });
});

describe("SovereignFirewall.maskKnownNames", () => {
    it("replaces the person, each word of their name and the company, and unmask restores them", () => {
        const text = "Thanks - Jane Doe, Acme Robotics. jane here; Janet from IT said hi. Doe's team";
        const { safeContext, tokenMap } = SovereignFirewall.maskKnownNames(text, { person: "Jane Doe", company: "Acme Robotics" });

        expect(safeContext).not.toMatch(/Jane Doe|Acme|Robotics/);
        expect(safeContext).not.toMatch(/\bjane\b/i);
        expect(safeContext).toContain("Janet");
        expect(SovereignFirewall.unmask(safeContext, tokenMap)).toBe(text);
    });

    it("leaves text alone when there are no names, and ignores 1-2 letter name parts", () => {
        expect(SovereignFirewall.maskKnownNames("Hello Al", {}).safeContext).toBe("Hello Al");
        expect(SovereignFirewall.maskKnownNames("Hello Al Smith", { person: "Al Smith" }).safeContext).not.toContain("Smith");
        expect(SovereignFirewall.maskKnownNames("I am at home", { person: "Al Smith", company: "at" }).safeContext).toBe("I am at home");
    });

    it("treats regex characters in a company name literally", () => {
        const { safeContext } = SovereignFirewall.maskKnownNames("Ping C++ (Labs) now", { company: "C++ (Labs)" });
        expect(safeContext).toMatch(/^Ping \[COMPANY_[a-f0-9]{12}\] now$/);
    });
});

describe("SovereignFirewall.mask with no edge node set up", () => {
    beforeEach(() => {
        clearEdgeEnv();
        post.mockReset();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it("does not call out at all, and still masks locally when asked", async () => {
        const { safeContext, tokenMap } = await SovereignFirewall.mask(TEXT, "GLOBAL", undefined, { alwaysMask: true });
        expect(post).not.toHaveBeenCalled();
        expect(safeContext).not.toContain("jane.doe@acme.com");
        expect(SovereignFirewall.unmask(safeContext, tokenMap)).toBe(TEXT);
    });

    it("never opens the breaker, however many calls it sees", async () => {
        for (let i = 0; i < 5; i++) await SovereignFirewall.mask(TEXT);
        expect(post).not.toHaveBeenCalled();
        expect((SovereignFirewall as any).breaker.isOpen()).toBe(false);
    });
});

describe("SovereignFirewall.mask with an edge node set up", () => {
    const SANITIZED = "Hi <NAME_1 confidence='0.90'>, mail <EMAIL_1 confidence='0.99'>";

    beforeEach(() => {
        clearEdgeEnv();
        process.env["EDGE_NODE_URI"] = "http://edge.test:8000/";
        process.env["EDGE_API_KEY"] = "k-test";
        post.mockReset();
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
        clearEdgeEnv();
    });

    it("sanitizes on the edge with the api key and tenant, and restores the reply from the edge's map", async () => {
        post.mockImplementation(async (url: string, body: any) => {
            if (url.endsWith("/v1/sanitize")) return { data: { sanitized_text: SANITIZED, token_map_id: "sess-1", stats: {} } };
            return { data: { original: body.token.endsWith("NAME_1") ? "Jane" : "jane@acme.com" } };
        });

        const { safeContext, tokenMap } = await SovereignFirewall.mask("Hi Jane, mail jane@acme.com", "GLOBAL", undefined, { teamId: "team-1" });

        expect(safeContext).toBe(SANITIZED);
        const [url, body, config] = post.mock.calls[0] as any[];
        expect(url).toBe("http://edge.test:8000/v1/sanitize");
        expect(body).toMatchObject({ tenant_id: "team-1" });
        expect(config.headers).toMatchObject({ "X-API-Key": "k-test" });
        const reid = post.mock.calls.filter((c) => String(c[0]).endsWith("/v1/reidentify")).map((c: any) => c[1]);
        expect(reid).toEqual(expect.arrayContaining([
            expect.objectContaining({ token: "sess-1_NAME_1", session_id: "sess-1", tenant_id: "team-1" }),
            expect.objectContaining({ token: "sess-1_EMAIL_1", session_id: "sess-1", tenant_id: "team-1" }),
        ]));
        expect(SovereignFirewall.unmask("Dear <NAME_1 confidence='0.90'>", tokenMap)).toBe("Dear Jane");
    });

    it("fails closed when the edge is down: nothing is returned for the provider, even with alwaysMask", async () => {
        post.mockRejectedValue(new Error("connect ECONNREFUSED"));
        await expect(SovereignFirewall.mask(TEXT, "GLOBAL", undefined, { alwaysMask: true })).rejects.toThrow(/PII/);
    });

    it("fails closed when a token cannot be read back from the edge", async () => {
        post.mockImplementation(async (url: string) => {
            if (url.endsWith("/v1/sanitize")) return { data: { sanitized_text: SANITIZED, token_map_id: "sess-1", stats: {} } };
            throw new Error("404");
        });
        await expect(SovereignFirewall.mask("Hi Jane")).rejects.toThrow(/PII/);
    });

    it("fails closed while the breaker is open, without calling the edge", async () => {
        post.mockRejectedValue(new Error("down"));
        for (let i = 0; i < 3; i++) await SovereignFirewall.mask(TEXT).catch(() => {});
        post.mockClear();
        await expect(SovereignFirewall.mask(TEXT)).rejects.toThrow(/PII/);
        expect(post).not.toHaveBeenCalled();
    });
});

describe("SovereignFirewall.unmask with regex characters in a token", () => {
    it("restores the literal token and nothing that merely matches it", () => {
        const tokenMap = new Map([["[A+B]", "Jane"]]);
        expect(SovereignFirewall.unmask("Hi [A+B] and [AAB]", tokenMap)).toBe("Hi Jane and [AAB]");
    });

    it("does not treat a backslash in a token as an escape", () => {
        const tokenMap = new Map([["[X\d]", "Jane"]]);
        expect(SovereignFirewall.unmask("Hi [X\d] and [X5]", tokenMap)).toBe("Hi Jane and [X5]");
    });
});
