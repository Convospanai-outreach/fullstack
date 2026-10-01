import { createHash } from "crypto";

// Honeypot + minimum fill time + Cloudflare Turnstile + a per-address throttle.
// The first two catch naive form-posting bots; Turnstile catches the rest. All
// verdicts for the cheap checks look like success to the caller, so a bot gets no
// signal about what tripped it.

const MIN_FILL_MS = 1500;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function looksLikeBot(body: { website?: unknown; elapsedMs?: unknown }) {
    if (typeof body.website === "string" && body.website.length > 0) return true;
    return typeof body.elapsedMs !== "number" || body.elapsedMs < MIN_FILL_MS;
}

// With no TURNSTILE_SECRET_KEY configured the check is skipped (so signup keeps
// working until the keys are provisioned); once the secret is set, a missing,
// invalid or unverifiable token is a failure.
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
    const secret = process.env["TURNSTILE_SECRET_KEY"];
    if (!secret) return true;
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

    try {
        const res = await fetch(TURNSTILE_VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ secret, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
            signal: AbortSignal.timeout(5000),
        });
        const data = (await res.json()) as { success?: boolean };
        return data.success === true;
    } catch {
        return false;
    }
}

// k-anonymity lookup: only the first 5 hex chars of the SHA-1 leave the server.
// Fails open on any error - a Have I Been Pwned outage must not block signup.
export async function isBreachedPassword(password: string): Promise<boolean> {
    try {
        const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
        const prefix = sha1.slice(0, 5);
        const suffix = sha1.slice(5);
        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { "Add-Padding": "true" },
            signal: AbortSignal.timeout(2000),
        });
        if (!res.ok) return false;
        const text = await res.text();
        return text.split("\n").some((line) => {
            const [hash, count] = line.trim().split(":");
            return hash === suffix && Number(count) > 0;
        });
    } catch {
        return false;
    }
}

export function clientIpFromRequest(req: Request) {
    return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Caps how often one address can be targeted regardless of the (spoofable)
// client IP, so rotating X-Forwarded-For doesn't defeat the per-IP limit.
export async function allowForEmail(email: string, endpoint: string, maxRequests: number, windowMs: number) {
    const { checkRateLimit } = await import("@/lib/rateLimit");
    const result = await checkRateLimit(`email:${email}`, { windowMs, maxRequests }, endpoint);
    return result.allowed;
}
