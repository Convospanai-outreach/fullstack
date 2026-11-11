import { describe, expect, it } from "vitest";
import { serializeRequestForLog } from "../requestLogSerializer";

describe("serializeRequestForLog", () => {
    it("keeps the path and drops the query string", () => {
        const logged = serializeRequestForLog({
            method: "GET",
            url: "/email/unsubscribe?token=secret-token&x=1",
            host: "api.example.com",
            ip: "203.0.113.1",
            socket: { remotePort: 5555 },
        });

        expect(logged).toEqual({
            method: "GET",
            url: "/email/unsubscribe",
            host: "api.example.com",
            remoteAddress: "203.0.113.1",
            remotePort: 5555,
        });
        expect(JSON.stringify(logged)).not.toContain("secret-token");
    });

    it("leaves a path with no query string alone", () => {
        expect(serializeRequestForLog({ method: "POST", url: "/leads" }).url).toBe("/leads");
    });
});
