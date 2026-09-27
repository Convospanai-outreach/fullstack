import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentContext } from "@/lib/auth";

// background.js has no re-mint/refresh flow, so this is a standing credential, not a copy-paste window.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function POST() {
    const { userId } = await getCurrentContext();
    if (!userId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

    const { prisma } = await import("@/lib/db");

    // Extension tokens are only revoked on request (DELETE below), so garbage-collect
    // this user's own already-expired ones whenever they mint a new one - bounds
    // Session table growth without touching any other still-valid device's token.
    await prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });

    // This row is an extension credential, not a web login: NextAuth uses JWT strategy
    // and never reads the Session table today. If that strategy is ever switched to
    // "database", this token would also become a valid NextAuth web session.
    await prisma.session.create({
        data: { sessionToken: token, userId, expires }
    });

    return NextResponse.json({ ok: true, token, expiresAt: expires.toISOString() });
}

// Revokes every extension token this user has minted (all devices) - the kill
// switch for a lost machine or leaked token. Session rows are only ever extension
// credentials (see the NextAuth note above), so this never signs anyone out of
// the web app, and the where clause keeps it scoped to the caller's own rows.
export async function DELETE() {
    const { userId } = await getCurrentContext();
    if (!userId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { prisma } = await import("@/lib/db");
    const { count } = await prisma.session.deleteMany({ where: { userId } });

    return NextResponse.json({ ok: true, revoked: count });
}
