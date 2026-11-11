import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { RequestContext } from '@/lib/requestContext';

const { db, invoked } = vi.hoisted(() => ({ db: {
  mcpOAuthGrant: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, teamMember: { findFirst: vi.fn() },
  mcpRelayClaim: { create: vi.fn(), deleteMany: vi.fn() }, mcpToolAction: { updateMany: vi.fn() },
}, invoked: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/app/api/campaigns/route', () => ({
  GET: async () => { invoked(); return NextResponse.json(RequestContext.get()?.mcpIdentity); },
  POST: async (req: Request) => { invoked(); return NextResponse.json({ context: RequestContext.get()?.mcpIdentity, body: await req.json() }); },
}));
import { POST } from './route';
const signingSecret = 'independent-unit-test-mcp-relay-secret';
let grant: any;
const raw = (changes: Record<string, unknown> = {}) => JSON.stringify({ operation: 'create_campaign', args: { name: 'Draft', icpId: 'icp-1' },
  grantId: 'grant-1', timestamp: Date.now(), nonce: randomUUID(), actionId: randomUUID(), ...changes });
function request(body: string, signature = createHmac('sha256', signingSecret).update(body).digest('hex')) {
  const { timestamp, grantId } = JSON.parse(body);
  const admission = createHmac('sha256', signingSecret).update(JSON.stringify(['mcp-admission-v1', timestamp, grantId, 'POST', '/api/mcp/execute'])).digest('hex');
  return new Request('http://localhost/api/mcp/execute', { method: 'POST', headers: {
    'content-type': 'application/json', 'x-cmf-mcp-signature': signature,
    'x-cmf-mcp-admission': `${timestamp}.${grantId}.${admission}`,
  }, body }) as NextRequest;
}
beforeEach(() => {
  vi.clearAllMocks(); process.env['MCP_ENABLED'] = 'true'; process.env['NEXTAUTH_SECRET'] = 'separate-web-login-secret'; process.env['MCP_RELAY_SECRET'] = signingSecret;
  process.env['MCP_PUBLIC_URL'] = 'https://api.example/mcp';
  grant = { userId: 'user-1', teamId: 'team-1', scopes: ['cmf:read','cmf:write'], resource: 'https://api.example/mcp',
    sessionVersion: 2, revokedAt: null, accessExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 60000) };
  db.mcpOAuthGrant.findUnique.mockImplementation(async () => grant);
  db.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 2 });
  db.teamMember.findFirst.mockResolvedValue({ role: 'member' });
  db.mcpToolAction.updateMany.mockResolvedValue({ count: 1 });
  db.mcpRelayClaim.create.mockResolvedValue({}); db.mcpRelayClaim.deleteMany.mockResolvedValue({ count: 0 });
});

describe('API-to-web MCP delegation', () => {
  it('rejects unsigned and tampered requests before accessing data', async () => {
    expect((await POST(request(raw(), 'invalid'))).status).toBe(401);
    const body = raw(); const signature = createHmac('sha256', signingSecret).update(body).digest('hex');
    expect((await POST(request(body.replace('Draft', 'Injected'), signature))).status).toBe(401);
    expect(db.mcpOAuthGrant.findUnique).not.toHaveBeenCalled();
  });
  it('requires a valid admission credential bound to the body grant and a separate relay key', async () => {
    const absent = request(raw()); absent.headers.delete('x-cmf-mcp-admission');
    expect((await POST(absent)).status).toBe(401);
    const altered = request(raw()); altered.headers.set('x-cmf-mcp-admission', altered.headers.get('x-cmf-mcp-admission')!.replace('grant-1', 'grant-2'));
    expect((await POST(altered)).status).toBe(401);
    process.env['NEXTAUTH_SECRET'] = signingSecret;
    expect((await POST(request(raw()))).status).toBe(401);
    expect(invoked).not.toHaveBeenCalled();
  });
  it('refuses a change without an approved, running action that this relay call can claim once', async () => {
    const { actionId, ...withoutAction } = JSON.parse(raw());
    expect((await POST(request(JSON.stringify(withoutAction)))).status).toBe(403);
    db.mcpToolAction.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request(raw()))).status).toBe(403);
    expect(db.mcpToolAction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      grantId: 'grant-1', operation: 'create_campaign', status: 'RUNNING', webClaimedAt: null }) }));
    expect(invoked).not.toHaveBeenCalled();
  });
  it('invokes the current web handler under an isolated, grant-derived workspace context', async () => {
    const response = await POST(request(raw()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ context: { userId: 'user-1', teamId: 'team-1' }, body: { name: 'Draft', icpId: 'icp-1' } });
    expect(RequestContext.get()?.mcpIdentity).toBeUndefined();
    expect(db.teamMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', teamId: 'team-1', status: 'active' } }));
  });
  it.each([undefined, '1'])('stops oversized streams with Content-Length %s before buffering the entire body', async contentLength => {
    let chunks = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunks++ < 8) controller.enqueue(new Uint8Array(16_384).fill(97));
        else controller.close();
      }, cancel,
    });
    const headers = new Headers({ 'x-cmf-mcp-signature': '0'.repeat(64) });
    if (contentLength) headers.set('content-length', contentLength);
    const req = new Request('http://localhost/api/mcp/execute', { method: 'POST', headers, body: stream, duplex: 'half' } as RequestInit) as NextRequest;
    expect((await POST(req)).status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(chunks).toBeLessThan(8);
    expect(db.mcpOAuthGrant.findUnique).not.toHaveBeenCalled();
    expect(invoked).not.toHaveBeenCalled();
  });
  it('rejects a declared oversized body before accessing data', async () => {
    const req = request(raw()); req.headers.set('content-length', '65537');
    expect((await POST(req)).status).toBe(413);
    expect(db.mcpOAuthGrant.findUnique).not.toHaveBeenCalled();
  });
  it('verifies signatures over streamed UTF-8 bytes even when a character spans chunks', async () => {
    const body = raw({ args: { name: 'Café', icpId: 'icp-1' } });
    const bytes = Buffer.from(body);
    const split = bytes.indexOf(Buffer.from('é')) + 1;
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(bytes.subarray(0, split)); controller.enqueue(bytes.subarray(split)); controller.close();
    } });
    const req = new Request('http://localhost/api/mcp/execute', {
      method: 'POST', headers: request(body).headers, body: stream, duplex: 'half',
    } as RequestInit) as NextRequest;
    expect((await POST(req)).status).toBe(200);
    expect(invoked).toHaveBeenCalledOnce();
  });
  it.each(['https://API.Example/mcp', 'https://api.example:443/mcp'])('accepts the canonical equivalent resource %s', async resource => {
    process.env['MCP_PUBLIC_URL'] = resource;
    expect((await POST(request(raw()))).status).toBe(200);
    expect(invoked).toHaveBeenCalledOnce();
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
