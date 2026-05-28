import { describe, it, expect, vi } from 'vitest';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    job: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logWorker: vi.fn()
}));

describe('Worker dispatch', () => {
  it('throws on unknown job type', async () => {
    const { dispatch } = await import('../../src/workers/index');
    // @ts-expect-error testing unknown type
    await expect(dispatch({ id: '1', type: 'unknown_type', payload: {} }))
      .rejects.toThrow('Unknown job type');
  });
});
