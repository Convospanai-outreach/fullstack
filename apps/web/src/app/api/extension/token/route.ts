import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import { getCurrentContext } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";

// background.js has no re-mint/refresh flow, so this is a standing credential, not a copy-paste window.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

class AccountChangedError extends Error {}

export async function POST() {
    const { prisma } = await import("@/lib/db");
    const { userId, teamId } = await getCurrentContext();
    if (!userId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    // The session version this browser's sign-in carries (sign-in checks are cached for 30 seconds, so the
    // cookie, not a fresh read, says which version the caller really holds). Null when there is no cookie.
    const jwt = await getToken({ req: { cookies: await cookies(), headers: {} } as any }).catch(() => null);
    const before = jwt ? (typeof jwt["sessionVersion"] === "number" ? jwt["sessionVersion"] : 0) : null;

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

    // Extension tokens are only revoked on request (DELETE below), so garbage-collect
    // this user's own already-expired ones whenever they mint a new one - bounds
    // Session table growth without touching any other still-valid device's token.
    await prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });

    // This row is an extension credential, not a web login: NextAuth uses JWT strategy
    // and never reads the Session table today. If that strategy is ever switched to
    // "database", this token would also become a valid NextAuth web session.
    // The token is for the team the user is in right now: the extension saves every lead there,
    // so someone in several teams needs no team picker (apps/api routes/extension/_lib/auth.ts).
    // The credential and the record of its minting commit together (the token itself is never logged).
    // A user with no team has no workspace to record it under.
    // The user row is locked so a sign-out cannot slip between the check and the insert: it either finishes
    // first (the version differs, so no token) or waits, then deletes the token this call just made.
    try {
        await prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<{ sessionVersion: number; suspendedAt: Date | null }[]>`SELECT "sessionVersion", "suspendedAt" FROM "User" WHERE id = ${userId} FOR UPDATE`;
            const row = rows[0];
            if (!row || row.suspendedAt || (before !== null && row.sessionVersion !== before)) throw new AccountChangedError();
            await tx.session.create({
                data: { sessionToken: token, userId, expires, teamId: teamId ?? null }
            });
            if (teamId) {
                await AuditService.log(teamId, userId, "extension_token_minted", "Session", null, {}, null, null, true, tx);
            }
        });
    } catch (error) {
        if (error instanceof AccountChangedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        throw error;
    }
    const team = teamId ? await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } }) : null;

    return NextResponse.json({ ok: true, token, expiresAt: expires.toISOString(), team });
}

// Revokes every extension token this user has minted (all devices) - the kill
// switch for a lost machine or leaked token. Session rows are only ever extension
// credentials (see the NextAuth note above), so this never signs anyone out of
// the web app, and the where clause keeps it scoped to the caller's own rows.
export async function DELETE() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { prisma } = await import("@/lib/db");
    const count = await prisma.$transaction(async (tx) => {
        const { count } = await tx.session.deleteMany({ where: { userId } });
        if (teamId) {
            await AuditService.log(teamId, userId, "extension_tokens_revoked", "Session", null, { revoked: count }, null, null, true, tx);
        }
        return count;
    });

    return NextResponse.json({ ok: true, revoked: count });
}
