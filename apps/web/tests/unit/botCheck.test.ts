import { vi } from "vitest";
import { createHash } from "crypto";
import { looksLikeBot, verifyTurnstile, isBreachedPassword } from "@/lib/botCheck";

describe("looksLikeBot", () => {
    it("flags a filled honeypot", () => {
        expect(looksLikeBot({ website: "http://spam.example", elapsedMs: 9000 })).toBe(true);
    });
    it("flags a too-fast or missing fill time", () => {
        expect(looksLikeBot({ website: "", elapsedMs: 200 })).toBe(true);
        expect(looksLikeBot({})).toBe(true);
        expect(looksLikeBot({ elapsedMs: "9000" })).toBe(true);
    });
    it("passes a plausible human submission", () => {
        expect(looksLikeBot({ website: "", elapsedMs: 8000 })).toBe(false);
    });
});

describe("verifyTurnstile", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("is skipped when no secret is configured", async () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "");
        expect(await verifyTurnstile(undefined, "1.2.3.4")).toBe(true);
    });

    it("rejects a missing token once the secret is set, without calling Cloudflare", async () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        expect(await verifyTurnstile("", "1.2.3.4")).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("accepts only when Cloudflare says success", async () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
        expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
        expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(false);
    });

    it("fails closed when Cloudflare is unreachable", async () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
        expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(false);
    });
});

describe("isBreachedPassword", () => {
    afterEach(() => vi.restoreAllMocks());
    const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

    it("sends only the 5-char prefix and matches on the suffix", async () => {
        const hash = sha1("password123");
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(`0000000000000000000000000000000000A:0\r\n${hash.slice(5)}:42\r\n`)
        );
        expect(await isBreachedPassword("password123")).toBe(true);
        expect(String(fetchSpy.mock.calls[0]![0])).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    });

    it("treats padded zero-count entries as not breached", async () => {
        const hash = sha1("a-unique-passphrase-9x");
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(`${hash.slice(5)}:0\r\n`));
        expect(await isBreachedPassword("a-unique-passphrase-9x")).toBe(false);
    });

    it("fails open when the service errors", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("down"));
        expect(await isBreachedPassword("anything")).toBe(false);
    });
});
