import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { fetchPublicPage, isBlockedAddress, UnsafeUrlError } from "../safePublicFetch";

describe("isBlockedAddress", () => {
    it.each([
        "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
        "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "not-an-ip",
    ])("blocks %s", (addr) => expect(isBlockedAddress(addr)).toBe(true));

    it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (addr) =>
        expect(isBlockedAddress(addr)).toBe(false));
});

describe("fetchPublicPage refuses unsafe targets", () => {
    it.each([
        "ftp://example.com/",
        "http://user:pw@example.com/",
        "http://example.com:8080/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::ffff:10.0.0.1]/",
        "not a url",
    ])("%s", async (u) => {
        await expect(fetchPublicPage(u)).rejects.toBeInstanceOf(UnsafeUrlError);
    });

    it("blocks a hostname that resolves to a private address", async () => {
        await expect(fetchPublicPage("http://localhost/")).rejects.toBeInstanceOf(UnsafeUrlError);
    });
});

// A real local server is only reachable through the lookup guard, which must refuse it.
describe("fetchPublicPage never reaches a local server", () => {
    let server: http.Server;
    let port = 0;
    let hits = 0;
    beforeAll(async () => {
        server = http.createServer((_req, res) => { hits++; res.setHeader("content-type", "text/html"); res.end("<p>hi</p>"); });
        await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
        port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("does not connect", async () => {
        // Port is not 80/443, so this is refused before connecting; the hit counter proves no request was made.
        await expect(fetchPublicPage(`http://127.0.0.1:${port}/`)).rejects.toBeInstanceOf(UnsafeUrlError);
        expect(hits).toBe(0);
    });
});
