import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { setupUser } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";
import { logger } from "@/lib/logger";

/**
 * User Registration Endpoint
 * 
 * Rate limiting is now handled by middleware.ts using the comprehensive
 * rate limiting service (src/lib/rateLimit.ts)
 * 
 * Configuration: 5 attempts per hour per IP (RATE_LIMITS.AUTH)
 */

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        if (!rawBody) {
            return NextResponse.json({ error: "Missing request body" }, { status: 400 });
        }

        let parsedBody: { name?: string; email?: string; password?: string } = {};
        try {
            parsedBody = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { name, email, password } = parsedBody;

        if (!email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        });

        // Initialize user with default settings and empty team
        await setupUser({
            id: user.id,
            email: user.email,
            name: user.name
        });

        // Get the teamId created in setupUser
        const membership = await prisma.teamMember.findFirst({
            where: { userId: user.id }
        });

        // Audit Log
        if (membership) {
            await AuditService.log(membership.teamId, user.id, "USER_CREATED", "Auth", user.id, { email: user.email });
        }

        // Send verification email
        try {
            const { EmailService } = await import('@/lib/emailService');
            const token = await EmailService.createVerificationToken(user.email);
            await EmailService.sendVerificationEmail(user.email, user.name || 'User', token);
        } catch (emailError) {
            logger.error('Failed to send verification email:', emailError);
            // Don't fail registration if email fails
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            message: 'Account created. You can start now; please verify your email when the message arrives.'
        });
    } catch (error: any) {
        logger.error("Registration error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
