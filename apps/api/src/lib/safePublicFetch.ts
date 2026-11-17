import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";

/**
 * Fetches a public web page for a URL a customer typed in. The address is
 * checked inside the connection's own DNS lookup, so the address that is
 * checked is the address that is connected to (a separate check-then-fetch can
 * be beaten by a DNS answer that changes in between). Redirects are followed
 * by hand and every hop is checked again.
 */

const BLOCKED = new net.BlockList();
for (const [net_, bits] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
    ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(net_, bits, "ipv4");
for (const [net_, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
    BLOCKED.addSubnet(net_, bits, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
    // ::ffff:10.0.0.1 is an IPv4 address written in IPv6 form; judge it as IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return BLOCKED.check(mapped[1], "ipv4");
    const family = net.isIP(address);
    if (family === 0) return true;
    return BLOCKED.check(address, family === 6 ? "ipv6" : "ipv4");
}

export class UnsafeUrlError extends Error {}

const guardedLookup: typeof dns.lookup = ((hostname: string, options: any, callback: any) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses: any) => {
        if (err) return callback(err);
        const list = addresses as dns.LookupAddress[];
        if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
            return callback(new UnsafeUrlError("That address is not a public website"));
        }
        if (options?.all) return callback(null, list);
        callback(null, list[0].address, list[0].family);
    });
}) as any;

export interface PublicPage {
    url: string;
    status: number;
    contentType: string;
    body: string;
}

export interface PublicFetchOptions {
    maxBytes?: number;
    maxRedirects?: number;
    timeoutMs?: number;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function parsePublicUrl(raw: string): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new UnsafeUrlError("That is not a valid web address");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http and https addresses are allowed");
    if (url.username || url.password) throw new UnsafeUrlError("Addresses with a login are not allowed");
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (port !== "80" && port !== "443") throw new UnsafeUrlError("Only the standard web ports are allowed");
    // A literal IP never reaches the lookup hook, so check it here.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && isBlockedAddress(host)) throw new UnsafeUrlError("That address is not a public website");
    return url;
}

function requestOnce(url: URL, maxBytes: number, signal: AbortSignal): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        const lib = url.protocol === "https:" ? https : http;
        const req = lib.request(
            url,
            {
                method: "GET",
                lookup: guardedLookup,
                signal,
                headers: { "User-Agent": "CraftMyFunnel-Scan/1.0", Accept: "text/html,application/xhtml+xml" },
            },
            (res) => {
                const status = res.statusCode ?? 0;
                if (REDIRECTS.has(status)) {
                    res.resume();
                    return resolve({ status, headers: res.headers, body: "" });
                }
                const type = String(res.headers["content-type"] ?? "").toLowerCase();
                if (!type.startsWith("text/html") && !type.startsWith("application/xhtml")) {
                    res.destroy();
                    return reject(new UnsafeUrlError("That address is not a web page"));
                }
                const chunks: Buffer[] = [];
                let total = 0;
                res.on("data", (chunk: Buffer) => {
                    total += chunk.length;
                    if (total > maxBytes) {
                        res.destroy();
                        return reject(new UnsafeUrlError("That page is too large"));
                    }
                    chunks.push(chunk);
                });
                res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
                res.on("error", reject);
            },
        );
        req.on("error", reject);
        req.end();
    });
}

export async function fetchPublicPage(rawUrl: string, opts: PublicFetchOptions = {}): Promise<PublicPage> {
    const { maxBytes = 1_500_000, maxRedirects = 3, timeoutMs = 10_000 } = opts;
    const signal = AbortSignal.timeout(timeoutMs);
    let url = parsePublicUrl(rawUrl);

    for (let hop = 0; ; hop++) {
        const res = await requestOnce(url, maxBytes, signal);
        const location = res.headers.location;
        if (REDIRECTS.has(res.status) && location) {
            if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects");
            url = parsePublicUrl(new URL(location, url).href);
            continue;
        }
        if (res.status < 200 || res.status >= 300) throw new UnsafeUrlError(`The site answered with status ${res.status}`);
        return { url: url.href, status: res.status, contentType: String(res.headers["content-type"] ?? ""), body: res.body };
    }
}
