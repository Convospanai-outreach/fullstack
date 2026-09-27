import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { lookup } from "node:dns/promises";
import { ingestService } from "./ingest";
import { vectorStore } from "./vectorStore";

// OPEN-273. Uses the real fetch and the real SSRF guard against local servers,
// since only a real fetch shows whether a redirect is followed.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("./vectorStore", () => ({ vectorStore: { addDocument: vi.fn() } }));

// The guard resolves each hop's host. The test servers are on loopback, which the
// guard rightly blocks, so a test marks the hops that stand in for a public
// attacker-owned host with mockResolvedValueOnce; every other lookup is real.
vi.mock("node:dns/promises", async (importActual) => {
    const actual = await importActual<typeof import("node:dns/promises")>();
    return { ...actual, lookup: vi.fn(actual.lookup) };
});
const { lookup: realLookup } = await vi.importActual<typeof import("node:dns/promises")>("node:dns/promises");
const PUBLIC = [{ address: "93.184.216.34", family: 4 }];

const PAGE = "<html><body>" + "Legitimate page content for the knowledge base. ".repeat(5) + "</body></html>";
const NON_PUBLIC = "Webhook URL resolves to a non-public address";

function listen(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as AddressInfo).port }));
    });
}

describe("IngestService.ingestUrl redirect handling (OPEN-273)", () => {
    const servers: http.Server[] = [];

    beforeEach(() => {
        vi.clearAllMocks();
        (lookup as Mock).mockReset().mockImplementation(realLookup);
        (vectorStore.addDocument as Mock).mockResolvedValue({ id: "doc-1" });
    });

    afterEach(async () => {
        await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
    });

    it("refuses a 302 to an internal host and never requests it", async () => {
        let internalHits = 0;
        const internal = await listen((_req, res) => {
            internalHits++;
            res.end("<html><body>" + "internal-admin-secret ".repeat(20) + "</body></html>");
        });
        const attacker = await listen((_req, res) => {
            res.writeHead(302, { Location: `http://127.0.0.1:${internal.port}/admin` });
            res.end();
        });
        servers.push(internal.server, attacker.server);
        (lookup as Mock).mockResolvedValueOnce(PUBLIC);

        await expect(ingestService.ingestUrl(`http://127.0.0.1:${attacker.port}/page`, "kb-1")).rejects.toThrow(NON_PUBLIC);

        expect(internalHits).toBe(0);
        expect(vectorStore.addDocument).not.toHaveBeenCalled();
    });

    it("refuses a 302 to the cloud metadata address 169.254.169.254", async () => {
        const attacker = await listen((_req, res) => {
            res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/iam/security-credentials/" });
            res.end();
        });
        servers.push(attacker.server);
        (lookup as Mock).mockResolvedValueOnce(PUBLIC);

        await expect(ingestService.ingestUrl(`http://127.0.0.1:${attacker.port}/page`, "kb-1")).rejects.toThrow(NON_PUBLIC);

        expect(vectorStore.addDocument).not.toHaveBeenCalled();
    });

    it("still follows a same-site redirect and ingests the final page", async () => {
        const site = await listen((req, res) => {
            if (req.url === "/old") {
                res.writeHead(301, { Location: "/new/" });
                res.end();
            } else {
                res.end(PAGE);
            }
        });
        servers.push(site.server);
        (lookup as Mock).mockResolvedValue(PUBLIC);

        const result = await ingestService.ingestUrl(`http://127.0.0.1:${site.port}/old`, "kb-1");

        expect(result.length).toBeGreaterThan(0);
        expect(vectorStore.addDocument).toHaveBeenCalledWith(
            expect.stringContaining("Legitimate page content"),
            "kb-1",
            { source: `http://127.0.0.1:${site.port}/old`, type: "URL" }
        );
    });

    it("stops after 3 redirects", async () => {
        let hits = 0;
        const loop = await listen((_req, res) => {
            hits++;
            res.writeHead(302, { Location: `/hop-${hits}` });
            res.end();
        });
        servers.push(loop.server);
        (lookup as Mock).mockResolvedValue(PUBLIC);

        await expect(ingestService.ingestUrl(`http://127.0.0.1:${loop.port}/start`, "kb-1")).rejects.toThrow("Too many redirects");

        expect(hits).toBe(4); // the original request plus 3 followed redirects
        expect(vectorStore.addDocument).not.toHaveBeenCalled();
    });

    it.each(["file:///etc/passwd", "ftp://example.com/file.txt", "gopher://127.0.0.1:6379/_INFO"])(
        "refuses the non-http URL %s",
        async (url) => {
            await expect(ingestService.ingestUrl(url, "kb-1")).rejects.toThrow(/protocol .* is not allowed/);
            expect(vectorStore.addDocument).not.toHaveBeenCalled();
        }
    );

    it("refuses a 302 to a non-http URL", async () => {
        const attacker = await listen((_req, res) => {
            res.writeHead(302, { Location: "file:///etc/passwd" });
            res.end();
        });
        servers.push(attacker.server);
        (lookup as Mock).mockResolvedValueOnce(PUBLIC);

        await expect(ingestService.ingestUrl(`http://127.0.0.1:${attacker.port}/page`, "kb-1"))
            .rejects.toThrow("Webhook URL protocol file: is not allowed");
        expect(vectorStore.addDocument).not.toHaveBeenCalled();
    });

    it("refuses a streamed body over the 5 MB cap", async () => {
        const big = await listen((_req, res) => {
            // No Content-Length: chunked, so only the streaming cap can catch it.
            const chunk = "a".repeat(64 * 1024);
            for (let i = 0; i < 96; i++) res.write(chunk); // 6 MB
            res.end();
        });
        servers.push(big.server);
        (lookup as Mock).mockResolvedValue(PUBLIC);

        await expect(ingestService.ingestUrl(`http://127.0.0.1:${big.port}/huge`, "kb-1")).rejects.toThrow("exceeds 5242880 bytes");
        expect(vectorStore.addDocument).not.toHaveBeenCalled();
    });
});
