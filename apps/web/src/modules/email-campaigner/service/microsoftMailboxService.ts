import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encryptCredential } from "@/lib/security/credentialVault";
import { sanitizeRelativePath } from "./googleMailboxService";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_ME_URL = "https://graph.microsoft.com/v1.0/me";
const MICROSOFT_SCOPES = "offline_access Mail.Send openid profile";

type OAuthStatePayload = {
    teamId: string;
    userId: string;
    nextPath?: string;
    nonce: string;
    ts: number;
};

function getMicrosoftConfig() {
    const clientId = process.env["MICROSOFT_CLIENT_ID"];
    const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"];
    const redirectUri =
        process.env["MICROSOFT_REDIRECT_URI"] ||
        "https://www.craftmyfunnel.live/api/integrations/microsoft/oauth/callback";

    if (!clientId || !clientSecret) {
        throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured.");
    }

    return { clientId, clientSecret, redirectUri };
}

function getStateSecret(): string | undefined {
    return process.env["NEXTAUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
}

function signState(payload: OAuthStatePayload): string {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Microsoft OAuth state signing.");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyState(state: string): OAuthStatePayload {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Microsoft OAuth state verification.");
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid OAuth state.");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new Error("Invalid OAuth state signature.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload || typeof payload !== "object" || !payload.teamId || !payload.userId) {
        throw new Error("Invalid OAuth state structure.");
    }
    return payload;
}

export function buildMicrosoftMailboxAuthUrl(input: { teamId: string; userId: string; nextPath?: string }): string {
    const { clientId, redirectUri } = getMicrosoftConfig();
    const nonce = crypto.randomUUID();
    const ts = Date.now();
    const statePayload: OAuthStatePayload = {
        teamId: input.teamId,
        userId: input.userId,
        nextPath: sanitizeRelativePath(input.nextPath),
        nonce,
        ts,
    };
    const state = signState(statePayload);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: MICROSOFT_SCOPES,
        state,
    });
    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function connectMicrosoftMailbox(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);
    const { clientId, clientSecret, redirectUri } = getMicrosoftConfig();

    const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code: input.code,
            redirect_uri: redirectUri,
            scope: MICROSOFT_SCOPES,
        }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange Microsoft token.");
    }

    const meRes = await fetch(MICROSOFT_ME_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meData = (await meRes.json()) as any;
    const email = (meData.mail || meData.userPrincipalName || "").toLowerCase().trim();
    if (!email) {
        throw new Error("Failed to retrieve Microsoft user email.");
    }

    const existingMailbox = await prisma.connectedMailbox.findFirst({ where: { email } });
    if (existingMailbox && existingMailbox.teamId !== statePayload.teamId) {
        throw new Error("Mailbox is already connected to another team.");
    }

    const encryptedAccessToken = await encryptCredential(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token ? await encryptCredential(tokenData.refresh_token) : null;
    const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    const mailbox = await prisma.connectedMailbox.upsert({
        where: { teamId_email: { teamId: statePayload.teamId, email } },
        create: {
            teamId: statePayload.teamId,
            provider: "MICROSOFT_365",
            authType: "OAUTH",
            email,
            displayName: meData.displayName || email,
            status: "CONNECTED",
            encryptedAccessToken: encryptedAccessToken as any,
            ...(encryptedRefreshToken ? { encryptedRefreshToken: encryptedRefreshToken as any } : {}),
            tokenExpiresAt,
            dailyLimit: 50,
            minDelaySeconds: 180,
        },
        update: {
            status: "CONNECTED",
            encryptedAccessToken: encryptedAccessToken as any,
            ...(encryptedRefreshToken ? { encryptedRefreshToken: encryptedRefreshToken as any } : {}),
            tokenExpiresAt,
            updatedAt: new Date(),
        },
    });

    return { mailbox, nextPath: statePayload.nextPath };
}
