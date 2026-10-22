import { describe, expect, it } from "vitest";
import { clientIp } from "./clientIp";

describe("clientIp", () => {
    it("uses CF-Connecting-IP, ignoring a client-supplied X-Forwarded-For", () => {
        const headers = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.18.0.1, 203.0.113.7" });
        expect(clientIp(headers)).toBe("203.0.113.7");
    });

    it("without CF-Connecting-IP, takes the rightmost X-Forwarded-For entry (the last proxy's), not the leftmost", () => {
        expect(clientIp(new Headers({ "x-forwarded-for": "198.18.0.1, 10.0.0.9" }))).toBe("10.0.0.9");
        expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    });

    it("falls back to X-Real-IP, then null", () => {
        expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
        expect(clientIp(new Headers())).toBeNull();
    });

    it("reads a plain header record, as NextAuth's authorize() passes", () => {
        expect(clientIp({ "x-forwarded-for": "198.18.0.1, 203.0.113.4" })).toBe("203.0.113.4");
        expect(clientIp({ "cf-connecting-ip": ["203.0.113.5"] })).toBe("203.0.113.5");
        expect(clientIp(undefined)).toBeNull();
    });
});
