import { Resolver, resolveMx as systemResolveMx, resolveTxt as systemResolveTxt } from "dns/promises";

// DNS lookups for the domain checks. They ask public resolvers first, so an answer does not depend on
// the server's own cache, and fall back to the system resolver. "No such record" is an ordinary answer
// (an empty list); a timeout or SERVFAIL is not an answer at all, so it throws and the caller must not
// treat the record as missing.

export class DnsUnavailableError extends Error {
    constructor(host: string) {
        super(`DNS lookup for ${host} could not be completed.`);
    }
}

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA"]);

let publicResolver: Resolver | null = null;
function getPublicResolver(): Resolver {
    if (!publicResolver) {
        publicResolver = new Resolver({ timeout: 4000, tries: 2 });
        publicResolver.setServers(["1.1.1.1", "8.8.8.8"]);
    }
    return publicResolver;
}

async function ask<T>(host: string, viaPublic: () => Promise<T[]>, viaSystem: () => Promise<T[]>): Promise<T[]> {
    try {
        return await viaPublic();
    } catch (err) {
        if (NOT_FOUND.has((err as NodeJS.ErrnoException).code || "")) return [];
    }
    try {
        return await viaSystem();
    } catch (err) {
        if (NOT_FOUND.has((err as NodeJS.ErrnoException).code || "")) return [];
        throw new DnsUnavailableError(host);
    }
}

export function lookupTxt(host: string): Promise<string[]> {
    return ask(
        host,
        async () => (await getPublicResolver().resolveTxt(host)).map((parts) => parts.join("")),
        async () => (await systemResolveTxt(host)).map((parts) => parts.join(""))
    );
}

export function lookupMx(host: string): Promise<string[]> {
    const names = (records: Array<{ exchange: string }>) => records.map((r) => r.exchange.toLowerCase().replace(/\.$/, ""));
    return ask(
        host,
        async () => names(await getPublicResolver().resolveMx(host)),
        async () => names(await systemResolveMx(host))
    );
}
