import { NextResponse } from 'next/server';
import { getCurrentContext } from '@/lib/auth';
import { EmailService } from '@/lib/emailService';
import { prisma } from '@/lib/db';

export async function POST() {
    try {
        const { userId } = await getCurrentContext();

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if already verified
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, emailVerified: true, name: true }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        if (user.emailVerified) {
            return NextResponse.json(
                { error: 'Email already verified' },
                { status: 400 }
            );
        }

        // Create new verification token
        const token = await EmailService.createVerificationToken(user.email);

        // Send verification email
        await EmailService.sendVerificationEmail(
            user.email,
            user.name || 'User',
            token
        );

        return NextResponse.json({
            success: true,
            message: 'Verification email sent'
        });
    } catch (error: any) {
        console.error('Resend verification error:', error);
        return NextResponse.json(
            { error: 'Failed to send verification email' },
            { status: 500 }
        );
    }
}
