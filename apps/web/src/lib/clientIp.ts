// The client's IP address for rate limits, login checks and audit logs.
//
// Both hostnames (and Render's own edge) sit behind Cloudflare, which sets CF-Connecting-IP itself and
// rejects requests that already carry one (error 1000), so it can't be forged. The leftmost
// X-Forwarded-For entry is whatever the client sent, so it is never used: without CF-Connecting-IP
// (local dev, tests) the rightmost entry, added by the last proxy, is the best available.

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

function header(headers: HeaderSource, name: string): string | undefined {
    if (!headers) return undefined;
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = headers[name];
    return (Array.isArray(value) ? value[0] : value) ?? undefined;
}

export function clientIp(headers: HeaderSource): string | null {
    const cloudflare = header(headers, "cf-connecting-ip")?.trim();
    if (cloudflare) return cloudflare;
    const forwarded = header(headers, "x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
    if (forwarded?.length) return forwarded[forwarded.length - 1]!;
    return header(headers, "x-real-ip")?.trim() || null;
}
