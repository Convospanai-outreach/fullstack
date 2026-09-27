import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminPassword } from "@/lib/superadmin/crypto";
import { signSuperAdminToken, SUPERADMIN_COOKIE_NAME, SUPERADMIN_COOKIE_MAX_AGE_SECONDS } from "@/lib/superadmin/session";
import { serializeCookie } from "@/lib/superadmin/cookieHeader";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientIp(req: NextRequest): string | null {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export async function POST(req: NextRequest) {
    // Per-IP attempt cap, checked before any DB work so a throttled source can't
    // add to the per-account failure counter below. Keyed explicitly on the IP -
    // not applyRateLimit's identifier, which trusts a caller-chosen x-api-key.
    const ipAddress = clientIp(req);
    const ipLimit = await checkRateLimit(`ip:${ipAddress ?? "unknown"}`, RATE_LIMITS.AUTH, "superadmin-login");
    if (!ipLimit.allowed) {
        const retryAfter = Math.max(1, Math.ceil((ipLimit.resetTime - Date.now()) / 1000));
        return NextResponse.json(
            { error: "Too many login attempts. Try again later." },
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
        );
    }

    const { prisma } = await import("@/lib/db");
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, enterpriseRole: true, superAdminCredential: true },
    });
    const credential = user?.superAdminCredential;

    if (!user || !credential) {
        // Same generic response whether the user or the credential is missing -
        // don't let this endpoint reveal which accounts have superadmin access.
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
        return NextResponse.json({ error: "Account locked. Try again later." }, { status: 429 });
    }

    const valid = await verifySuperAdminPassword(password, credential.passwordHash);

    if (!valid) {
        const failedAttempts = credential.failedAttempts + 1;
        const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
        await prisma.$transaction([
            prisma.superAdminCredential.update({
                where: { userId: user.id },
                data: { failedAttempts, lockedUntil },
            }),
            prisma.superAdminAuditLog.create({
                data: { userId: user.id, action: "LOGIN_FAILED", ipAddress, metadata: { failedAttempts } },
            }),
        ]);
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await prisma.$transaction([
        prisma.superAdminCredential.update({
            where: { userId: user.id },
            data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        }),
        prisma.superAdminAuditLog.create({
            data: { userId: user.id, action: "LOGIN", ipAddress },
        }),
    ]);

    const response = NextResponse.json({ ok: true });
    response.headers.append(
        "Set-Cookie",
        serializeCookie(SUPERADMIN_COOKIE_NAME, signSuperAdminToken(user.id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: SUPERADMIN_COOKIE_MAX_AGE_SECONDS,
        })
    );
    return response;
}
