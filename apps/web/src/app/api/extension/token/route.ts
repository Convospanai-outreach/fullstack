import { NextResponse } from "next/server";
import crypto from "crypto";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

// background.js has no re-mint/refresh flow, so this is a standing credential, not a copy-paste window.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function POST() {
    const user = await findOrCreateClerkAppUser();
    if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

    const { prisma } = await import("@/lib/db");

    // This row is an extension credential, not a web login: NextAuth uses JWT strategy
    // and never reads the Session table today. If that strategy is ever switched to
    // "database", this token would also become a valid NextAuth web session.
    await prisma.session.create({
        data: { sessionToken: token, userId: user.id, expires }
    });

    return NextResponse.json({ ok: true, token, expiresAt: expires.toISOString() });
}
