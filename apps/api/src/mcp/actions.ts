import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { McpConfig } from './config';
import type { McpPrincipal } from './oauth';

export type McpOutcome = { isError: boolean; content: { type: 'text'; text: string }[];
  structuredContent: { status: number; [key: string]: unknown }; _meta?: { 'mcp/www_authenticate': string[] } };
const REVIEW_MS = 10 * 60_000;
const RETAIN_MS = 7 * 86400_000;
export const actionHash = (operation: string, argumentsJson: string) => createHash('sha256').update(JSON.stringify([operation, argumentsJson])).digest('hex');
const message = (status: number, text: string, extra: Record<string, unknown> = {}): McpOutcome => ({
  isError: status >= 400, content: [{ type: 'text', text }], structuredContent: { status, ...extra },
});

/** Stage an exact request for browser review, then claim its execution once across API replicas. */
export async function executeReviewedAction(config: McpConfig, principal: McpPrincipal, operation: string,
  requestId: string, args: Record<string, unknown>, run: (actionId: string) => Promise<McpOutcome>): Promise<McpOutcome> {
  const argumentsJson = JSON.stringify(args);
  const argumentsHash = actionHash(operation, argumentsJson);
  const now = new Date();
  const action = await prisma.$transaction(async tx => {
    // Serialize the bounded pending queue for this account, including concurrent grants.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7401, hashtext(${principal.userId}))`;
    const existing = await tx.mcpToolAction.findUnique({ where: { grantId_requestId: { grantId: principal.grantId, requestId } } });
    if (existing) return existing;
    const pending = await tx.mcpToolAction.count({ where: { grant: { userId: principal.userId },
      status: { in: ['PENDING', 'APPROVED'] }, expiresAt: { gt: now } } });
    if (pending >= 50) return null;
    return tx.mcpToolAction.create({ data: { grantId: principal.grantId, requestId, operation, argumentsJson,
      argumentsHash, expiresAt: new Date(now.getTime() + REVIEW_MS), retainUntil: new Date(now.getTime() + RETAIN_MS) } });
  });
  if (!action) return message(429, 'Too many requests awaiting review. Review or cancel pending requests in CraftMyFunnel.');
  if (action.argumentsHash !== argumentsHash || action.operation !== operation) return message(409, 'This requestId belongs to a different change. Reuse it only with the original arguments.');
  if (action.result) return action.result as unknown as McpOutcome;
  const reviewUrl = `${config.webOrigin}/mcp/connect?action=${encodeURIComponent(action.id)}`;
  const state = { actionId: action.id, requestId, reviewUrl, actionStatus: action.status, expiresAt: action.expiresAt.toISOString() };
  if (action.status === 'REJECTED') return message(403, 'The user rejected this change.', state);
  if (['RUNNING', 'UNKNOWN'].includes(action.status)) return message(202, 'This request is already running or its outcome is uncertain. Inspect CraftMyFunnel; do not create a replacement request.', state);
  if (action.expiresAt <= now) return message(410, 'The review window closed before this change was approved, so nothing was changed. To try again, create a new request with a NEW requestId and ask the user to approve it promptly.', state);
  if (action.status !== 'APPROVED') return message(202, `No change has been made. Ask the user to open ${reviewUrl} and review the exact arguments in CraftMyFunnel. They must approve before ${action.expiresAt.toISOString()} (a ${REVIEW_MS / 60_000}-minute window). After approval, repeat this tool with the same requestId and arguments.`, state);
  const claimed = await prisma.mcpToolAction.updateMany({ where: { id: action.id, status: 'APPROVED', expiresAt: { gt: now } },
    data: { status: 'RUNNING', startedAt: now } });
  if (claimed.count !== 1) return message(202, 'Another request changed this action. Inspect its state before retrying.', state);
  let result: McpOutcome;
  try { result = await run(action.id); }
  catch { result = message(503, 'The outcome is uncertain. Inspect CraftMyFunnel before creating another change.', state); }
  const uncertain = result.structuredContent.status >= 500;
  try {
    await prisma.mcpToolAction.updateMany({ where: { id: action.id, status: 'RUNNING' }, data: {
      status: uncertain ? 'UNKNOWN' : result.isError ? 'FAILED' : 'SUCCEEDED', completedAt: new Date(),
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    } });
  } catch { return message(503, 'The outcome could not be recorded. Inspect CraftMyFunnel; this request will not be executed again automatically.', state); }
  return result;
}
