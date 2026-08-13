import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
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

    await prisma.session.create({
        data: { sessionToken: token, userId: user.id, expires }
    });

    return NextResponse.json({ ok: true, token, expiresAt: expires.toISOString() });
}
