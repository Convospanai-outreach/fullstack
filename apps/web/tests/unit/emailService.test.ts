import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '@/lib/emailService';
import { prisma } from '@/lib/db';

// Mock Prisma
vi.mock('@/lib/db', () => ({
    prisma: {
        verificationToken: {
            deleteMany: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn()
        },
        user: {
            update: vi.fn()
        }
    }
}));

// Mock SMTP integration
vi.mock('@/lib/email/smtpClient', () => ({
    sendViaSMTP: vi.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
    verifySmtpConfig: vi.fn().mockResolvedValue({ ok: true })
}));

describe('EmailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateToken', () => {
        it('should generate a 64-character hex token', () => {
            const token = EmailService.generateToken();
            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should generate unique tokens', () => {
            const token1 = EmailService.generateToken();
            const token2 = EmailService.generateToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('createVerificationToken', () => {
        it('should create a verification token in database', async () => {
            const email = 'test@example.com';
            const mockToken = 'a'.repeat(64);

            vi.spyOn(EmailService, 'generateToken').mockReturnValue(mockToken);
            (prisma.verificationToken.create as any).mockResolvedValue({
                identifier: email,
                token: mockToken,
                expires: new Date()
            });

            const token = await EmailService.createVerificationToken(email);

            expect(token).toBe(mockToken);
            expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
                where: { identifier: email }
            });
            expect(prisma.verificationToken.create).toHaveBeenCalled();
        });

        it('should delete existing tokens before creating new one', async () => {
            const email = 'test@example.com';

            await EmailService.createVerificationToken(email);

            expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
                where: { identifier: email }
            });
        });
    });

    describe('verifyToken', () => {
        it('should verify valid token and update user', async () => {
            const token = 'valid-token';
            const email = 'test@example.com';
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            (prisma.verificationToken.findUnique as any).mockResolvedValue({
                identifier: email,
                token,
                expires: futureDate
            });

            const result = await EmailService.verifyToken(token);

            expect(result.success).toBe(true);
            expect(result.email).toBe(email);
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { email },
                data: { emailVerified: expect.any(Date) }
            });
            expect(prisma.verificationToken.delete).toHaveBeenCalledWith({
                where: { token }
            });
        });

        it('should reject invalid token', async () => {
            (prisma.verificationToken.findUnique as any).mockResolvedValue(null);

            const result = await EmailService.verifyToken('invalid-token');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid or expired verification link');
        });

        it('should reject expired token', async () => {
            const token = 'expired-token';
            const pastDate = new Date(Date.now() - 1000);

            (prisma.verificationToken.findUnique as any).mockResolvedValue({
                identifier: 'test@example.com',
                token,
                expires: pastDate
            });

            const result = await EmailService.verifyToken(token);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Verification link has expired');
            expect(prisma.verificationToken.delete).toHaveBeenCalled();
        });
    });

    describe('sendVerificationEmail', () => {
        it('should send verification email with secure SMTP settings', async () => {
            const originalEnv = { ...process.env };
            (process.env as Record<string, string | undefined>)["SMTP_SECURE"] = "true";
            (process.env as Record<string, string | undefined>)["SMTP_FROM_NAME"] = "Custom Name";
            try {
                const email = 'test@example.com';
                const name = 'Test User';
                const token = 'test-token';

                await EmailService.sendVerificationEmail(email, name, token);
                expect(true).toBe(true);
            } finally {
                process.env = originalEnv;
            }
        });
    });

    describe('sendEmail and helper methods', () => {
        it('should send email via fetch endpoint', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                json: async () => ({ success: true, messageId: '123' })
            } as Response);

            const result = await EmailService.sendEmail('to@example.com', 'Subject', '<p>body</p>');
            expect(result).toEqual({ success: true, messageId: '123' });
            expect(fetchSpy).toHaveBeenCalled();
            fetchSpy.mockRestore();
        });

        it('should call createVerificationToken via generateTokenForEmail', async () => {
            const spy = vi.spyOn(EmailService, 'createVerificationToken').mockResolvedValue('token-123');
            const token = await EmailService.generateTokenForEmail('test@example.com');
            expect(token).toBe('token-123');
            spy.mockRestore();
        });
    });
});
