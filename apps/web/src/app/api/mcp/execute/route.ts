import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RequestContext } from '@/lib/requestContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const envelope = z.object({ operation: z.string().max(80), args: z.record(z.string(), z.unknown()),
  grantId: z.string().min(1).max(128), timestamp: z.number().int(), nonce: z.string().uuid() }).strict();
const ranks: Record<string, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

// Match the web-owned customer paths in /api/proxy. Dynamic imports preserve
// each existing handler's validation and business logic. No arbitrary imports.
async function operation(name: string) {
  switch (name) {
    case 'list_campaigns': return { method: 'GET', handler: (await import('@/app/api/campaigns/route')).GET, path: '/api/campaigns', viewer: true };
    case 'get_campaign': return { method: 'GET', handler: (await import('@/app/api/campaigns/[id]/route')).GET, path: '/api/campaigns/item', viewer: true };
    case 'get_campaign_analytics': return { method: 'GET', handler: (await import('@/app/api/campaigns/[id]/analytics/route')).GET, path: '/api/campaigns/item/analytics', viewer: true };
    case 'create_campaign': return { method: 'POST', handler: (await import('@/app/api/campaigns/route')).POST, path: '/api/campaigns', viewer: false };
    case 'update_campaign_details': return { method: 'PATCH', handler: (await import('@/app/api/campaigns/[id]/route')).PATCH, path: '/api/campaigns/item', viewer: false };
    case 'list_leads': return { method: 'GET', handler: (await import('@/app/api/leads/route')).GET, path: '/api/leads', viewer: false };
    case 'get_lead': return { method: 'GET', handler: (await import('@/app/api/leads/[id]/route')).GET, path: '/api/leads/item', viewer: false };
    case 'create_lead': return { method: 'POST', handler: (await import('@/app/api/leads/route')).POST, path: '/api/leads', viewer: false };
    case 'update_lead': return { method: 'PATCH', handler: (await import('@/app/api/leads/[id]/route')).PATCH, path: '/api/leads/item', viewer: false };
    case 'get_lead_timeline': return { method: 'GET', handler: (await import('@/app/api/leads/[id]/timeline/route')).GET, path: '/api/leads/item/timeline', viewer: false };
    default: return null;
  }
}

export async function POST(req: NextRequest) {
  const fail = (status: number) => NextResponse.json({ error: status === 404 ? 'Not found' : 'MCP delegation rejected' }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (process.env['MCP_ENABLED'] !== 'true') return fail(404);
  const secret = process.env['NEXTAUTH_SECRET'];
  const signature = req.headers.get('x-cmf-mcp-signature');
  if (!secret || !signature || !/^[a-f0-9]{64}$/.test(signature)) return fail(401);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 65_536) return fail(413);
  const expected = createHmac('sha256', secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return fail(401);
  let parsed;
  try { parsed = envelope.safeParse(JSON.parse(raw)); } catch { return fail(400); }
  if (!parsed.success) return fail(400);
  const { operation: name, args, grantId, timestamp, nonce } = parsed.data;
  if (timestamp > Date.now() + 5000 || Date.now() - timestamp > 30_000) return fail(401);
  if (args['id'] !== undefined && (typeof args['id'] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(args['id']))) return fail(400);
  try {
    const { prisma } = await import('@/lib/db');
    const grant = await prisma.mcpOAuthGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.revokedAt || grant.expiresAt <= new Date() || grant.accessExpiresAt <= new Date()) return fail(401);
    const resource = process.env['MCP_PUBLIC_URL'];
    if (!resource || grant.resource !== resource) return fail(401);
    const [user, membership] = await Promise.all([
      prisma.user.findUnique({ where: { id: grant.userId }, select: { suspendedAt: true, sessionVersion: true } }),
      prisma.teamMember.findFirst({ where: { userId: grant.userId, teamId: grant.teamId, status: 'active' }, select: { role: true } }),
    ]);
    if (!user || user.suspendedAt || user.sessionVersion !== grant.sessionVersion || !membership) return fail(403);
    const op = await operation(name);
    if (!op || !grant.scopes.includes(op.method === 'GET' ? 'cmf:read' : 'cmf:write') ||
      (ranks[membership.role] || 0) < (op.viewer ? 1 : 2)) return fail(403);
    // A unique DB insert rejects replay even across multiple web processes.
    try { await prisma.mcpRelayClaim.create({ data: { nonce, expiresAt: new Date(timestamp + 35_000) } }); }
    catch { return fail(401); }
    void prisma.mcpRelayClaim.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
    const url = new URL(op.path, 'http://mcp.internal');
    if (op.method === 'GET') for (const [key, value] of Object.entries(args)) if (key !== 'id') url.searchParams.set(key, String(value));
    const { id, ...fields } = args;
    const body = name === 'update_lead' ? args['changes'] : fields;
    const request = Object.assign(new Request(url, { method: op.method, headers: { 'content-type': 'application/json' },
      ...(op.method !== 'GET' ? { body: JSON.stringify(body) } : {}) }), { nextUrl: url }) as NextRequest;
    const handler = op.handler as (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    const response = await RequestContext.run({ correlationId: nonce, mcpIdentity: { userId: grant.userId, teamId: grant.teamId } },
      () => handler(request, { params: Promise.resolve({ id: typeof id === 'string' ? id : '' }) }));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'The operation failed. Inspect the app before retrying.' }, { status: 503 });
  }
}
