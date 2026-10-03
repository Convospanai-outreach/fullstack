import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/lib/emailService";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";
import { hashPassword, registerSchema } from "@/lib/passwordAuth";
import { allowForEmail, clientIpFromRequest, isBreachedPassword, looksLikeBot, verifyTurnstile } from "@/lib/botCheck";

export async function POST(req: NextRequest) {
    const { prisma } = await import("@/lib/db");
    const limited = await applyRateLimit(req, RATE_LIMITS.REGISTRATION, "register");
    if (limited) return limited;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const raw = (body ?? {}) as Record<string, unknown>;
    // Honeypot filled or form submitted faster than a person could: answer as if it
    // worked so the bot learns nothing, and create nothing.
    if (looksLikeBot(raw)) {
        return NextResponse.json({ success: true, emailSent: true }, { status: 201 });
    }
    if (!(await verifyTurnstile(raw["turnstileToken"], clientIpFromRequest(req)))) {
        return NextResponse.json({ error: "Bot check failed. Please refresh and try again." }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { email, password, firstName, lastName, phone, company } = parsed.data;

    if (!(await allowForEmail(email, "register", 5, 60 * 60 * 1000))) {
        return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }
    if (password.toLowerCase().includes(email.split("@")[0]!.toLowerCase()) && email.split("@")[0]!.length >= 4) {
        return NextResponse.json({ error: "Password must not contain your email address." }, { status: 400 });
    }
    if (await isBreachedPassword(password)) {
        return NextResponse.json(
            { error: "That password has appeared in a known data breach. Please choose a different one." },
            { status: 400 }
        );
    }

    if (await isSsoEnforcedForEmail(email)) {
        return NextResponse.json(
            { error: "Your organization requires single sign-on. Sign in through your SSO provider.", code: "sso-required" },
            { status: 403 }
        );
    }

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
        return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }

    try {
        await prisma.user.create({
            data: {
                email,
                name: `${firstName} ${lastName}`,
                firstName,
                lastName,
                phone,
                company,
                password: await hashPassword(password),
                // Unverified until the emailed link is used; login is refused until then.
                emailVerified: null,
                profileCompletedAt: new Date(),
                settings: { create: { theme: "dark" } },
            },
        });
    } catch (error) {
        // Lost a race with a concurrent signup for the same email (unique constraint).
        if ((error as { code?: string }).code === "P2002") {
            return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
        }
        throw error;
    }

    let emailSent = true;
    try {
        const token = await EmailService.createVerificationToken(email);
        await EmailService.sendVerificationEmail(email, firstName, token);
    } catch (error) {
        // The account exists; the user can request another link from the login page.
        console.error("Failed to send verification email", error);
        emailSent = false;
    }

    return NextResponse.json({ success: true, emailSent }, { status: 201 });
}
