import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDeductCredits } = vi.hoisted(() => ({
    mockDeductCredits: vi.fn()
}));

// Mock the credit service
vi.mock('@/lib/credits', () => ({
    deductCredits: mockDeductCredits
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    prisma: {
        lead: {
            findUnique: vi.fn().mockResolvedValue({ id: 'lead-1', fullName: 'Test Lead' }),
            update: vi.fn()
        },
        job: { create: vi.fn() }
    }
}));

// Mock Queue
vi.mock('@/lib/queue', () => ({
    JobQueue: { enqueue: vi.fn() }
}));

// Mock other services to avoid ESM/import issues
vi.mock('@/modules/scraper-bridge', () => ({
    scraperService: { scrape: vi.fn() }
}));

vi.mock('@/modules/hunter-email-finder', () => ({
    hunterService: { findAndStoreEmail: vi.fn() }
}));

// Import after mocks
import { handleLeadEnrichment } from '@/workers/handlers/enrichment-worker';

describe('Billing Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should deduct credits when userId is present', async () => {
        (mockDeductCredits as any).mockResolvedValue(true);

        const payload = {
            leadId: 'lead-1',
            campaignId: 'camp-1',
            userId: 'user-123',
            teamId: 'team-1'
        };

        await handleLeadEnrichment(payload);

        expect(mockDeductCredits).toHaveBeenCalledWith('team-1', 1, expect.stringContaining('Enrichment'), expect.any(Object));
    });

    it('should fail job if insufficient credits', async () => {
        (mockDeductCredits as any).mockResolvedValueOnce(false);

        const payload = {
            leadId: 'lead-1',
            userId: 'user-broke',
            teamId: 'team-broke'
        };

        await expect(handleLeadEnrichment(payload)).rejects.toThrow('Insufficient credits');
    });

    it('should warn but proceed if no userId (legacy support)', async () => {
        const payload = { leadId: 'lead-old' };
        await handleLeadEnrichment(payload);
        expect(mockDeductCredits).not.toHaveBeenCalled();
    });
});
