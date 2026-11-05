import { prisma } from '@/lib/db';

/** Remove expired credentials and review payloads; preserve active grants and recent public clients. */
export async function cleanupMcpRecords(now = new Date()) {
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
