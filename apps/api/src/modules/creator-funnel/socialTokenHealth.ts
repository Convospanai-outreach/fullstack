import { prisma } from "@/lib/db";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";

// Daily check of connected Meta (Facebook Page / Instagram) tokens. A token Meta reports as
// invalid moves the account to NEEDS_RECONNECT; one that expires within a week warns the team's
// admins once. Admins are told through the existing NotificationDispatcher (in-app + email).
//
// GET /debug_token?input_token=... with an app access token ("app_id|app_secret") returns
// is_valid, expires_at and data_access_expires_at (0 = never), per
// https://developers.facebook.com/docs/graph-api/reference/debug_token, checked 2026-09-30.
// Long-lived Page tokens report no expiry
// (https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived).
//
// LinkedIn (profile and page) tokens last 60 days and can't be refreshed by us (programmatic
// refresh is partner-only; authorization-code-flow, checked 2026-10-04), so the expiry saved at
// connect drives the warning, a passed expiry means reconnect, and a cheap bearer call
// (linkedinApi.tokenStillValid) catches a token the person revoked. No LinkedIn secret is needed here.

const GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 50;
const TIMEOUT_MS = 10_000;

const PLATFORM_LABEL: Record<string, string> = {
    FACEBOOK_PAGE: "Facebook Page",
    INSTAGRAM: "Instagram account",
    LINKEDIN_MEMBER: "LinkedIn profile",
    LINKEDIN_ORG: "LinkedIn page",
};
const LINKEDIN = ["LINKEDIN_MEMBER", "LINKEDIN_ORG"];

type Verdict = { valid: boolean; expiresAt: Date | null; reason: string } | "unknown";

async function checkMeta(token: string, appId: string, appSecret: string): Promise<Verdict> {
    const res = await fetch(
        `${GRAPH_BASE_URL}/debug_token?` + new URLSearchParams({ input_token: token, access_token: `${appId}|${appSecret}` }),
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.data) return "unknown"; // couldn't ask Meta; try again tomorrow
    const expiries = [unixToDate(json.data.expires_at), unixToDate(json.data.data_access_expires_at)].filter((d): d is Date => d !== null);
    return {
        valid: json.data.is_valid === true,
        reason: json.data.error?.message || "Meta reports the connection is no longer valid.",
        expiresAt: expiries.length ? new Date(Math.min(...expiries.map((d) => d.getTime()))) : null,
    };
}

async function checkLinkedIn(platform: string, token: string, expiresAt: Date | null, now: Date): Promise<Verdict> {
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
        return { valid: false, expiresAt, reason: "LinkedIn connections last 60 days and this one has ended." };
    }
    const { tokenStillValid } = await import("./linkedinApi");
    const valid = await tokenStillValid(platform, token);
    if (valid === null) return "unknown";
    return { valid, expiresAt, reason: "LinkedIn reports the connection is no longer valid." };
}

async function notifyAdmins(teamId: string, title: string, message: string) {
    const admins = await prisma.teamMember.findMany({
        where: { teamId, status: "active", role: { in: ["owner", "admin"] }, userId: { not: null } },
        select: { userId: true },
    });
    const { NotificationDispatcher } = await import("@/lib/notifications");
    for (const admin of admins) {
        await NotificationDispatcher.send(admin.userId as string, "SYSTEM", title, message, { teamId });
    }
}

function unixToDate(value: unknown) {
    return typeof value === "number" && value > 0 ? new Date(value * 1000) : null;
}

export async function checkSocialTokens(now = new Date()) {
    const result = { checked: 0, needsReconnect: 0, warned: 0 };
    const appId = process.env["FACEBOOK_APP_ID"];
    const appSecret = process.env["FACEBOOK_APP_SECRET"];
    // Meta accounts need the app credentials to be checked; LinkedIn accounts don't.
    const platforms = appId && appSecret ? ["FACEBOOK_PAGE", "INSTAGRAM", ...LINKEDIN] : LINKEDIN;

    const accounts = await prisma.socialAccount.findMany({
        where: {
            platform: { in: platforms as any },
            status: "CONNECTED",
            OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - CHECK_EVERY_MS) } }],
        },
        orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
        take: BATCH,
        select: { id: true, teamId: true, platform: true, handle: true, encryptedToken: true, expiryWarnedAt: true, tokenExpiresAt: true },
    });

    for (const account of accounts) {
        result.checked++;
        const name = `${PLATFORM_LABEL[account.platform] ?? "Social account"} ${account.handle ?? ""}`.trim();
        try {
            const token = await decryptCredential(account.encryptedToken as unknown as EncryptedCredential).catch(() => undefined);
            const verdict: Verdict = !token
                ? { valid: false, expiresAt: null, reason: "The saved token can't be read." }
                : LINKEDIN.includes(account.platform)
                  ? await checkLinkedIn(account.platform, token, account.tokenExpiresAt, now)
                  : await checkMeta(token, appId as string, appSecret as string);
            if (verdict === "unknown") {
                // Couldn't ask the platform; leave the status alone and try again tomorrow.
                await prisma.socialAccount.update({ where: { id: account.id }, data: { lastCheckedAt: now } });
                continue;
            }
            const { valid, expiresAt, reason } = verdict;

            if (!valid) {
                await prisma.socialAccount.update({
                    where: { id: account.id },
                    data: { status: "NEEDS_RECONNECT", lastError: reason, lastCheckedAt: now },
                });
                result.needsReconnect++;
                await notifyAdmins(account.teamId, `Reconnect ${name}`, "CraftMyFunnel can no longer post or read messages for it. Open Settings > Social accounts and reconnect.");
                continue;
            }

            const warn = expiresAt !== null && expiresAt.getTime() - now.getTime() < WARN_BEFORE_MS && !account.expiryWarnedAt;
            await prisma.socialAccount.update({
                where: { id: account.id },
                data: { tokenExpiresAt: expiresAt, lastCheckedAt: now, lastError: null, ...(warn ? { expiryWarnedAt: now } : {}) },
            });
            if (warn) {
                result.warned++;
                await notifyAdmins(account.teamId, `${name} needs reconnecting soon`, "Its connection expires within a week. Open Settings > Social accounts and reconnect to keep posting and messaging.");
            }
        } catch (error) {
            console.error(`[SocialTokens] Check failed for account ${account.id}:`, error instanceof Error ? error.message : error);
        }
    }
    return result;
}
