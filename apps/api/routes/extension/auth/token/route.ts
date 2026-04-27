import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    try {
        const requiredKey = process.env["EXTENSION_API_KEY"];
        const providedKey = req.headers.get("x-extension-key");

        if (!requiredKey || providedKey !== requiredKey) {
            return NextResponse.json({ ok: false, error: "Invalid extension key" }, { status: 401 });
        }

        const rawAuth = req.headers.get("authorization");
        let sessionToken = null;

        if (rawAuth && rawAuth.trim().toLowerCase().startsWith("bearer ")) {
            sessionToken = rawAuth.trim().slice(7).trim();
        }

        if (!sessionToken) {
            // Also check cookies
            const cookieHeader = req.headers.get("cookie");
            if (cookieHeader) {
                const match = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
                if (match) sessionToken = match[1];
            }
        }

        if (!sessionToken) {
            return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { sessionToken },
            include: { user: { include: { memberships: true } } }
        });

        if (!session || !session.user) {
            return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
        }

        const user = session.user;
        const teamIds = user.memberships.map((m: any) => m.teamId).filter(Boolean);

        // Generate a fast opaque token specifically for the extension
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours


        await prisma.session.create({
            data: {
                sessionToken: token,
                userId: user.id,
                expires: expiresAt
            }
        });

        return NextResponse.json({
            ok: true,
            token,
            expiresAt: expiresAt.toISOString(),
            userId: user.id,
            teamIds
        });

    } catch (e: any) {
        console.error("Token issuance failed:", e);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
