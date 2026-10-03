import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/lib/emailService";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { allowForEmail } from "@/lib/botCheck";

// Always answers 200 so this can't be used to probe which emails are registered.
export async function POST(req: NextRequest) {
    const { prisma } = await import("@/lib/db");
    const limited = await applyRateLimit(req, RATE_LIMITS.REGISTRATION, "resend-verification");
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    // Per-address cap so this can't be used to flood someone's inbox with links,
    // even from rotating IPs. Over the cap still answers 200 (no signal to callers).
    if (email && (await allowForEmail(email, "resend-verification", 3, 15 * 60 * 1000))) {
        try {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { firstName: true, name: true, password: true, emailVerified: true },
            });
            // Only password accounts that still owe verification get a link.
            if (user?.password && !user.emailVerified) {
                const token = await EmailService.createVerificationToken(email);
                await EmailService.sendVerificationEmail(email, user.firstName || user.name || "", token);
            }
        } catch (error) {
            console.error("Failed to resend verification email", error);
        }
    }

    return NextResponse.json({ success: true });
}
