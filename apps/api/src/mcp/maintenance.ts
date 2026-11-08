import { prisma } from '@/lib/db';

const STUCK_AFTER_MS = 10 * 60_000;

/** Remove expired credentials and review payloads; preserve active grants and recent public clients. */
export async function cleanupMcpRecords(now = new Date()) {
  // A process that died mid-change leaves its action RUNNING for good. Live runs end within seconds, so one this old
  // has an uncertain outcome: mark it so the agent is told to inspect it rather than to wait.
  await prisma.mcpToolAction.updateMany({ where: { status: 'RUNNING', startedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { status: 'UNKNOWN', completedAt: now } });
  await prisma.mcpToolAction.deleteMany({ where: { retainUntil: { lte: now } } });
  await prisma.mcpOAuthCode.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.mcpOAuthRefreshUse.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.mcpRelayClaim.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.mcpOAuthGrant.deleteMany({ where: { OR: [
    { expiresAt: { lte: now } },
    { accessTokenHash: null, refreshTokenHash: null, createdAt: { lt: new Date(now.getTime() - 10 * 60_000) }, codes: { none: {} } },
  ] } });
  await prisma.mcpOAuthClient.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 86400_000) }, grants: { none: {} } } });
}
