import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

const TOKEN_TTL_SECONDS = 15 * 60;

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
