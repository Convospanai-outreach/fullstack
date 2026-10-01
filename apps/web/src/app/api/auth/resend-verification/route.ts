import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailService } from "@/lib/emailService";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Always answers 200 so this can't be used to probe which emails are registered.
export async function POST(req: NextRequest) {
    const limited = await applyRateLimit(req, RATE_LIMITS.REGISTRATION, "resend-verification");
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (email) {
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
