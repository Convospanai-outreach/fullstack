import crypto from "crypto";

// Creator funnel signed links: the landing page link in a keyword auto-reply carries ?t=<token>,
// so when the person signs up on that page the intake worker can merge the sign-up into the lead
// the auto-reply went to, instead of creating a second one. The token names only the auto-reply
// (KeywordTriggerReply id) and an expiry: no personal data, and the lead is looked up from the
// reply at intake. It's an HMAC over the payload with NEXTAUTH_SECRET (domain-separated), the
// same secret the Stripe Connect and Gmail OAuth states use.

export const LINK_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const DOMAIN = "creator-funnel-link:";
const SIG_LENGTH = 22; // 132 bits of a base64url HMAC-SHA256

function secret() {
    const value = process.env["NEXTAUTH_SECRET"];
    if (!value) throw new Error("NEXTAUTH_SECRET is required for creator funnel link signing.");
    return value;
}

function signature(body: string) {
    return crypto.createHmac("sha256", secret()).update(DOMAIN + body).digest("base64url").slice(0, SIG_LENGTH);
}

export function signLinkToken(replyId: string, now = new Date()) {
    const body = Buffer.from(JSON.stringify({ r: replyId, e: Math.floor((now.getTime() + LINK_TOKEN_TTL_MS) / 1000) })).toString("base64url");
    return `${body}.${signature(body)}`;
}

/** The auto-reply id the token was issued for, or null if it's forged, malformed or expired at `at`. */
export function verifyLinkToken(token: string, at: Date): string | null {
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra !== undefined) return null;
    let expected: string;
    try {
        expected = signature(body);
    } catch {
        return null;
    }
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (typeof payload?.r !== "string" || typeof payload?.e !== "number") return null;
        if (at.getTime() > payload.e * 1000) return null;
        return payload.r;
    } catch {
        return null;
    }
}
