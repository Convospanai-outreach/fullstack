import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { RequestContext } from '@/lib/requestContext';

const { db, invoked } = vi.hoisted(() => ({ db: {
  mcpOAuthGrant: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, teamMember: { findFirst: vi.fn() },
  mcpRelayClaim: { create: vi.fn(), deleteMany: vi.fn() },
}, invoked: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/app/api/campaigns/route', () => ({
  GET: async () => { invoked(); return NextResponse.json(RequestContext.get()?.mcpIdentity); },
  POST: async (req: Request) => { invoked(); return NextResponse.json({ context: RequestContext.get()?.mcpIdentity, body: await req.json() }); },
}));
import { POST } from './route';
const signingSecret = 'unit-test-mcp-relay-secret';
let grant: any;
const raw = (changes: Record<string, unknown> = {}) => JSON.stringify({ operation: 'create_campaign', args: { name: 'Draft', icpId: 'icp-1' },
  grantId: 'grant-1', timestamp: Date.now(), nonce: randomUUID(), ...changes });
function request(body: string, signature = createHmac('sha256', signingSecret).update(body).digest('hex')) {
  return new Request('http://localhost/api/mcp/execute', { method: 'POST', headers: {
    'content-type': 'application/json', 'x-cmf-mcp-signature': signature,
  }, body }) as NextRequest;
}
beforeEach(() => {
  vi.clearAllMocks(); process.env['MCP_ENABLED'] = 'true'; process.env['NEXTAUTH_SECRET'] = signingSecret;
  process.env['MCP_PUBLIC_URL'] = 'https://api.example/mcp';
  grant = { userId: 'user-1', teamId: 'team-1', scopes: ['cmf:read','cmf:write'], resource: 'https://api.example/mcp',
    sessionVersion: 2, revokedAt: null, accessExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 60000) };
  db.mcpOAuthGrant.findUnique.mockImplementation(async () => grant);
  db.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 2 });
  db.teamMember.findFirst.mockResolvedValue({ role: 'member' });
  db.mcpRelayClaim.create.mockResolvedValue({}); db.mcpRelayClaim.deleteMany.mockResolvedValue({ count: 0 });
});

describe('API-to-web MCP delegation', () => {
  it('rejects unsigned and tampered requests before accessing data', async () => {
    expect((await POST(request(raw(), 'invalid'))).status).toBe(401);
    const body = raw(); const signature = createHmac('sha256', signingSecret).update(body).digest('hex');
    expect((await POST(request(body.replace('Draft', 'Injected'), signature))).status).toBe(401);
    expect(db.mcpOAuthGrant.findUnique).not.toHaveBeenCalled();
  });
  it('invokes the current web handler under an isolated, grant-derived workspace context', async () => {
    const response = await POST(request(raw()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ context: { userId: 'user-1', teamId: 'team-1' }, body: { name: 'Draft', icpId: 'icp-1' } });
    expect(RequestContext.get()?.mcpIdentity).toBeUndefined();
    expect(db.teamMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', teamId: 'team-1', status: 'active' } }));
  });
  it('rejects an expired capability and an arbitrary operation', async () => {
    expect((await POST(request(raw({ timestamp: Date.now() - 60000 })))).status).toBe(401);
    expect((await POST(request(raw({ operation: 'send_email' })))).status).toBe(403);
    expect(invoked).not.toHaveBeenCalled();
  });
  it('rejects replay across instances using the database unique constraint', async () => {
    db.mcpRelayClaim.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Unique constraint'));
    const body = raw();
    expect((await POST(request(body))).status).toBe(200);
    expect((await POST(request(body))).status).toBe(401);
    expect(invoked).toHaveBeenCalledTimes(1);
  });
  it.each(['revoked','expired','resource','membership','suspended','session','scope','role'])('rejects changed %s before invocation', async reason => {
    if (reason === 'revoked') grant.revokedAt = new Date();
    if (reason === 'expired') grant.expiresAt = new Date(0);
    if (reason === 'resource') grant.resource = 'https://other.example/mcp';
    if (reason === 'membership') db.teamMember.findFirst.mockResolvedValue(null);
    if (reason === 'suspended') db.user.findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 2 });
    if (reason === 'session') db.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 3 });
    if (reason === 'scope') grant.scopes = ['cmf:read'];
    if (reason === 'role') db.teamMember.findFirst.mockResolvedValue({ role: 'viewer' });
    expect((await POST(request(raw()))).status).toBeGreaterThanOrEqual(400);
    expect(invoked).not.toHaveBeenCalled();
  });
  it('is unavailable until explicitly enabled', async () => {
    process.env['MCP_ENABLED'] = 'false';
    expect((await POST(request(raw()))).status).toBe(404);
    expect(db.mcpOAuthGrant.findUnique).not.toHaveBeenCalled();
  });
});
