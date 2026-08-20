import crypto from "crypto";
import { prisma } from "@/lib/db";

// Signed, single-use OAuth state for the Stripe Connect flow - same scheme
// (HMAC-signed payload + a hashed, expiring, single-use nonce row in
// VerificationToken) already used by the Gmail mailbox OAuth flow
// (googleMailboxService.ts's signState/verifyState), reimplemented here
// rather than reaching into that module's private helpers.
const STATE_NONCE_DOMAIN = "stripe-connect-oauth-state";
const STATE_TTL_MS = 10 * 60 * 1000;

interface StripeConnectStatePayload {
    teamId: string;
    userId: string;
    nonce: string;
    ts: number;
}

function getStateSecret(): string {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) throw new Error("NEXTAUTH_SECRET is required for Stripe Connect state signing.");
    return secret;
}

function digestNonce(nonce: string): string {
    return crypto.createHmac("sha256", getStateSecret()).update(`${STATE_NONCE_DOMAIN}:${nonce}`).digest("hex");
}

function signState(payload: StripeConnectStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyStateSignature(state: string): StripeConnectStatePayload {
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid state.");
    const expected = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new Error("Invalid state signature.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StripeConnectStatePayload;
    if (!payload?.teamId || !payload?.userId || !payload?.nonce || typeof payload.ts !== "number") {
        throw new Error("Invalid state structure.");
    }
    if (Date.now() - payload.ts > STATE_TTL_MS) {
        throw new Error("State expired.");
    }
    return payload;
}

export async function createStripeConnectState(teamId: string, userId: string): Promise<string> {
    const nonce = crypto.randomUUID();
    const ts = Date.now();
    const state = signState({ teamId, userId, nonce, ts });

    await prisma.verificationToken.create({
        data: {
            identifier: `stripe-connect-state:${teamId}:${userId}`,
            token: digestNonce(nonce),
            expires: new Date(ts + STATE_TTL_MS),
        },
    });

    return state;
}

export async function consumeStripeConnectState(state: string): Promise<{ teamId: string; userId: string }> {
    const payload = verifyStateSignature(state);
    const identifier = `stripe-connect-state:${payload.teamId}:${payload.userId}`;

    const deleteResult = await prisma.verificationToken.deleteMany({
        where: {
            identifier,
            token: digestNonce(payload.nonce),
            expires: { gt: new Date() },
        },
    });

    if (deleteResult.count !== 1) {
        throw new Error("Invalid state, expired state, or state already consumed.");
    }

    return { teamId: payload.teamId, userId: payload.userId };
}
