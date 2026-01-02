import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/auth/verify-email/route';
import { EmailService } from '@/lib/emailService';

// Mock EmailService
vi.mock('@/lib/emailService', () => ({
    EmailService: {
        verifyToken: vi.fn()
    }
}));

describe('POST /api/auth/verify-email', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should verify valid token', async () => {
        const token = 'valid-token';
        const email = 'test@example.com';

        (EmailService.verifyToken as any).mockResolvedValue({
            success: true,
            email
        });

        const request = new Request(`http://localhost:3000/api/auth/verify-email?token=${token}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.email).toBe(email);
    });

    it('should reject invalid token', async () => {
        (EmailService.verifyToken as any).mockResolvedValue({
            success: false,
            error: 'Invalid or expired verification link'
        });

        const request = new Request('http://localhost:3000/api/auth/verify-email?token=invalid');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid or expired verification link');
    });

    it('should return 400 if token is missing', async () => {
        const request = new Request('http://localhost:3000/api/auth/verify-email');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Verification token is required');
    });

    it('should handle server errors gracefully', async () => {
        (EmailService.verifyToken as any).mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost:3000/api/auth/verify-email?token=test');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to verify email');
    });
});
