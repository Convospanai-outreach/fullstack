import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { registerMcp, executeMcpTool, describeTools } from './server';
import { authenticateMcpToken, digest } from './oauth';
import { getMcpConfig, parseScopes, redirectUriSchema } from './config';
import { MCP_OPERATIONS } from './catalog';
import { cleanupMcpRecords } from './maintenance';
import { TeamRole } from '@/lib/permissions';
import { verifyInternalAuthHeaders } from '@/lib/internalAuth';

const mocks = vi.hoisted(() => ({
  db: {
    mcpOAuthClient: { create: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), deleteMany: vi.fn() },
    mcpOAuthGrant: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    mcpOAuthCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
    mcpOAuthRefreshUse: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    team: { findMany: vi.fn() },
    teamMember: { findFirst: vi.fn(), findMany: vi.fn() }, user: { findUnique: vi.fn() },
    mcpToolAction: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    mcpRelayClaim: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() }, $transaction: vi.fn(), $executeRaw: vi.fn(),
  }, getToken: vi.fn(), rate: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: mocks.db }));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: mocks.rate }));

const config = { resource: 'http://localhost:3001/mcp', issuer: 'http://localhost:3001', webOrigin: 'http://localhost:3000' };
const verifier = 'v'.repeat(43);
const auth = { client_id: 'client-1', redirect_uri: 'https://agent.example/callback', response_type: 'code',
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  resource: config.resource, scope: 'cmf:read cmf:write cmf:generate', state: 'user-state' };
const principal = { grantId: 'grant-1', userId: 'user-1', teamId: 'team-1', scopes: ['cmf:read','cmf:write','cmf:generate'],
  role: TeamRole.MEMBER, email: 'test@example.com', enterpriseRole: 'SALES_USER' };
const token = 't'.repeat(43);
const requestId = '11111111-1111-4111-8111-111111111111';
let grant: any;
let apps: ReturnType<typeof Fastify>[] = [];
async function app() {
  const instance = Fastify(); apps.push(instance); await instance.register(rateLimit, { global: false }); registerMcp(instance, config); await instance.ready(); return instance;
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret-for-mcp-tests';
  process.env.MCP_RELAY_SECRET = 'independent-test-relay-key-32-characters';
  mocks.rate.mockResolvedValue({ allowed: true, remaining: 60, resetTime: Date.now() + 60000 });
  grant = { id: 'grant-1', clientId: 'client-1', userId: 'user-1', teamId: 'team-1', sessionVersion: 0,
    scopes: [...principal.scopes], resource: config.resource, accessTokenHash: digest(token), refreshTokenHash: digest('refresh'),
    revokedAt: null, expiresAt: new Date(Date.now() + 86400000), accessExpiresAt: new Date(Date.now() + 3600000) };
  mocks.db.mcpOAuthClient.findUnique.mockResolvedValue({ id: 'client-1', name: 'Agent', redirectUris: [auth.redirect_uri] });
  mocks.db.mcpOAuthClient.findUniqueOrThrow.mockResolvedValue({ id: 'client-1', name: 'Agent', redirectUris: [auth.redirect_uri] });
  mocks.db.mcpOAuthGrant.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.accessTokenHash && where.accessTokenHash !== grant.accessTokenHash) return null;
    if (where.refreshTokenHash && where.refreshTokenHash !== grant.refreshTokenHash) return null;
    return grant;
  });
  mocks.db.user.findUnique.mockResolvedValue({ email: principal.email, enterpriseRole: 'SALES_USER', suspendedAt: null, sessionVersion: 0 });
  mocks.db.teamMember.findFirst.mockResolvedValue({ role: 'member' });
  mocks.db.teamMember.findMany.mockResolvedValue([{ teamId: 'team-1', role: 'member', team: { name: 'Team' } }]);
  mocks.db.auditLog.create.mockResolvedValue({});
  mocks.db.mcpOAuthRefreshUse.create.mockResolvedValue({});
  mocks.db.mcpOAuthRefreshUse.findUnique.mockResolvedValue(null);
  mocks.db.mcpOAuthRefreshUse.deleteMany.mockResolvedValue({ count: 0 });
  mocks.db.$transaction.mockImplementation(fn => fn(mocks.db));
  mocks.db.$executeRaw.mockResolvedValue(1);
  mocks.db.mcpOAuthClient.count.mockResolvedValue(0);
  mocks.db.mcpOAuthGrant.count = vi.fn().mockResolvedValue(0);
  mocks.db.mcpToolAction.findUnique.mockResolvedValue(null);
  mocks.db.mcpToolAction.count.mockResolvedValue(0);
  mocks.db.mcpToolAction.findMany.mockResolvedValue([]);
  mocks.db.mcpToolAction.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.mcpToolAction.create.mockImplementation(async ({ data }: any) => ({ id: 'action-1', status: 'APPROVED', result: null, ...data }));
  mocks.db.mcpOAuthGrant.updateMany.mockImplementation(async ({ where, data }: any) => {
    if (where.refreshTokenHash && where.refreshTokenHash !== grant.refreshTokenHash) return { count: 0 };
    Object.assign(grant, data); return { count: 1 };
  });
  mocks.getToken.mockResolvedValue({ sub: 'user-1', sessionVersion: 0 });
});
afterEach(async () => { await Promise.all(apps.map(instance => instance.close())); apps = []; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('remote MCP protocol and authorization', () => {
  it('allows initialize anonymously but requires a token for tools/list', async () => {
    const instance = await app();
    const init = await instance.inject({ method: 'POST', url: '/mcp', headers: { accept: 'application/json, text/event-stream' }, payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } } });
    expect(init.statusCode).toBe(200);
    const list = await instance.inject({ method: 'POST', url: '/mcp', headers: { accept: 'application/json, text/event-stream' }, payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
    expect(list.statusCode).toBe(401);
    expect(list.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource/mcp');
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
  it('challenges unauthenticated calls with resource discovery metadata', async () => {
    const instance = await app();
    const response = await instance.inject({ method: 'POST', url: '/mcp', payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_leads', arguments: {} } } });
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource/mcp');
    expect(response.json().result._meta['mcp/www_authenticate'][0]).toContain('error_description=');
  });
  it('does not let an invalid bearer use anonymous discovery', async () => {
    const instance = await app();
    const response = await instance.inject({ method: 'POST', url: '/mcp', headers: { authorization: 'Bearer invalid' }, payload: { method: 'tools/list' } });
    expect(response.statusCode).toBe(401);
  });
  it('rejects an untrusted browser origin', async () => {
    const instance = await app();
    expect((await instance.inject({ method: 'POST', url: '/mcp', headers: { origin: 'https://evil.example' }, payload: { method: 'initialize' } })).statusCode).toBe(403);
  });
  it('isolates verified MCP users behind the same IP without trusting arbitrary bearer strings', async () => {
    const instance = await app();
    const secondToken = 'u'.repeat(43);
    const second = { ...grant, id: 'grant-2', userId: 'user-2', accessTokenHash: digest(secondToken) };
    mocks.db.mcpOAuthGrant.findUnique.mockImplementation(async ({ where }: any) =>
      where.accessTokenHash === grant.accessTokenHash ? grant : where.accessTokenHash === second.accessTokenHash ? second : null);
    const ping = (bearer: string) => instance.inject({ method: 'POST', url: '/mcp',
      headers: { authorization: `Bearer ${bearer}`, accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id: 1, method: 'ping' } });
    for (let index = 0; index < 60; index++) expect((await ping(token)).statusCode).toBe(200);
    expect((await ping(token)).statusCode).toBe(429);
    expect((await ping(secondToken)).statusCode).toBe(200);
    expect((await ping('z'.repeat(43))).statusCode).toBe(401);
    const keys = mocks.rate.mock.calls.filter(call => call[2] === 'mcp-tools').map(call => call[0]);
    expect(keys).toContain('user:user-1:team:team-1'); expect(keys).toContain('user:user-2:team:team-1');
  });
  it('uses the existing API path with a verified identity and a pinned workspace', async () => {
    const instance = Fastify(); apps.push(instance);
    await instance.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    instance.get('/pipeline/stats', async req => ({ identity: verifyInternalAuthHeaders(req.headers, { method: 'GET', path: '/pipeline/stats' })?.sub, cookie: req.headers.cookie }));
    const result = await executeMcpTool(instance, config, principal, 'get_pipeline_stats', {});
    expect(result.structuredContent).toMatchObject({ status: 200, data: { identity: 'user-1', cookie: 'convo-workspace-id=team-1' } });
  });
  it('rejects privilege escalation and caller-supplied team IDs', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'create_task', { requestId, title: 'task', teamId: 'other-team' })).rejects.toThrow('Invalid tool arguments');
    const result = await executeMcpTool(instance, config, { ...principal, scopes: ['cmf:read'] }, 'create_task', { requestId, title: 'task' });
    expect(result.structuredContent.status).toBe(403);
    expect(result._meta?.['mcp/www_authenticate'][0]).toContain('scope="cmf:write"');
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });
  it('rechecks current role independently of OAuth scopes', async () => {
    const instance = await app();
    const result = await executeMcpTool(instance, config, { ...principal, role: TeamRole.VIEWER }, 'create_task', { requestId, title: 'task' });
    expect(result.structuredContent.status).toBe(403);
  });
  it('forbids status activation and arbitrary targets', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'update_campaign_details', { requestId, id: 'campaign', status: 'active' })).rejects.toThrow();
    await expect(executeMcpTool(instance, config, principal, 'get_campaign', { id: '../other' })).rejects.toThrow();
    await expect(executeMcpTool(instance, config, principal, 'request', { url: 'https://evil.example' })).rejects.toThrow('Unknown tool');
  });
  it.each([
    ['phone', '+1234567890'], ['jobTitle', 'Manager'], ['location', 'London'],
    ['tags', ['customer']], ['consentObtained', true],
  ])('rejects unsupported lead update field %s before dispatch', async (field, value) => {
    const instance = await app();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const changes of [{ [field as string]: value }, { fullName: 'Updated', [field as string]: value }]) {
      await expect(executeMcpTool(instance, config, principal, 'update_lead', { requestId, id: 'lead-1', changes }))
        .rejects.toThrow('Invalid tool arguments');
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects an empty lead update', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'update_lead', { requestId, id: 'lead-1', changes: {} }))
      .rejects.toThrow('Invalid tool arguments');
  });
  it.each([true, false])('rejects unsupported consentObtained=%s when creating a lead', async consentObtained => {
    const instance = await app();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(executeMcpTool(instance, config, principal, 'create_lead', { requestId, email: 'lead@example.com', consentObtained }))
      .rejects.toThrow('Invalid tool arguments');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(describeTools().find(item => item.name === 'create_lead')!.inputSchema.properties).not.toHaveProperty('consentObtained');
  });
  it('advertises and relays the lead contact fields supported by the web PATCH handler', async () => {
    const instance = await app();
    const changes = { fullName: 'Updated', email: 'updated@example.com', linkedIn: 'https://www.linkedin.com/in/updated', company: 'Example' };
    const tool = describeTools().find(item => item.name === 'update_lead')!;
    expect(Object.keys(tool.inputSchema.properties.changes.properties).sort()).toEqual(Object.keys(changes).sort());
    expect(tool.inputSchema.properties.changes.additionalProperties).toBe(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'lead-1', ...changes }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await executeMcpTool(instance, config, principal, 'update_lead', { requestId, id: 'lead-1', changes });
    expect(result.structuredContent.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args).toEqual({ id: 'lead-1', changes });
  });
  it('preserves insufficient-credit status without exposing prompts in audit rows', async () => {
    const instance = Fastify(); apps.push(instance);
    instance.post('/ai/preview', async (_req, reply) => reply.code(402).send({ error: 'Insufficient credits' }));
    const result = await executeMcpTool(instance, config, principal, 'generate_message_preview', { requestId, goal: 'private customer goal' });
    expect(result.isError).toBe(true); expect(result.structuredContent.status).toBe(402);
    expect(JSON.stringify(mocks.db.auditLog.create.mock.calls)).not.toContain('private customer goal');
  });
  it('sends web operations to a fixed signed first-party relay without the OAuth token', async () => {
    const instance = await app();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'campaign' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await executeMcpTool(instance, config, principal, 'create_campaign', { requestId, name: 'Draft', icpId: 'icp-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/api/mcp/execute');
    expect(init.headers.authorization).toBeUndefined();
    expect(init.headers['x-cmf-mcp-signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(init.body)).toMatchObject({ operation: 'create_campaign', grantId: 'grant-1', args: { icpId: 'icp-1' } });
  });
  it('stages a change for browser review and runs nothing until the user approves it', async () => {
    const instance = await app();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    mocks.db.mcpToolAction.create.mockImplementation(async ({ data }: any) => ({ id: 'action-1', status: 'PENDING', result: null, ...data }));
    const result = await executeMcpTool(instance, config, principal, 'create_campaign', { requestId, name: 'Draft', icpId: 'icp-1' });
    expect(result.structuredContent).toMatchObject({ status: 202, actionStatus: 'PENDING' });
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('/mcp/connect?action=action-1') });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.mcpToolAction.updateMany).not.toHaveBeenCalled();
  });
  it('reuses a stored result and rejects a requestId reused with different arguments', async () => {
    const instance = await app();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { actionHash } = await import('./actions');
    const args = { name: 'Draft', icpId: 'icp-1' };
    const stored = { id: 'action-1', status: 'SUCCEEDED', operation: 'create_campaign', argumentsHash: actionHash('create_campaign', JSON.stringify(args)),
      expiresAt: new Date(Date.now() + 60000), result: { isError: false, content: [], structuredContent: { status: 201 } } };
    mocks.db.mcpToolAction.findUnique.mockResolvedValue(stored);
    expect((await executeMcpTool(instance, config, principal, 'create_campaign', { requestId, ...args })).structuredContent.status).toBe(201);
    expect((await executeMcpTool(instance, config, principal, 'create_campaign', { requestId, name: 'Other', icpId: 'icp-1' })).structuredContent.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  // Real clients may show only content[].text, so everything an agent or user must act on has to be in the text.
  it('puts everything needed to act in the text of each reviewed-change outcome', async () => {
    const instance = await app();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { actionHash } = await import('./actions');
    const args = { title: 'task', priority: 'MEDIUM' }; // priority is the schema default, so it is part of the stored request
    const base = { id: 'action-1', operation: 'create_task', argumentsHash: actionHash('create_task', JSON.stringify(args)), result: null };
    const run = async (row: Record<string, unknown>) => {
      mocks.db.mcpToolAction.findUnique.mockResolvedValue({ ...base, ...row });
      const result = await executeMcpTool(instance, config, principal, 'create_task', { requestId, title: 'task' });
      return result.content.map(part => part.text).join(' ');
    };
    const soon = new Date(Date.now() + 5 * 60_000);
    const pending = await run({ status: 'PENDING', expiresAt: soon });
    expect(pending).toContain('/mcp/connect?action=action-1');
    expect(pending).toContain(soon.toISOString());
    const expired = await run({ status: 'PENDING', expiresAt: new Date(Date.now() - 1000) });
    expect(expired).toMatch(/nothing was changed/i);
    expect(expired).toMatch(/NEW requestId/);
    expect(await run({ status: 'REJECTED', expiresAt: soon })).toMatch(/rejected/i);
    expect(await run({ status: 'UNKNOWN', expiresAt: soon })).toMatch(/do not create a replacement/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refuses new reviewed requests beyond the pending queue limit', async () => {
    const instance = await app();
    mocks.db.mcpToolAction.count.mockResolvedValue(50);
    const result = await executeMcpTool(instance, config, principal, 'create_task', { requestId, title: 'task' });
    expect(result.structuredContent.status).toBe(429);
    expect(mocks.db.mcpToolAction.create).not.toHaveBeenCalled();
  });
  it('requires an independent relay secret', async () => {
    const { getMcpRelaySecret } = await import('./config');
    process.env.MCP_RELAY_SECRET = process.env.NEXTAUTH_SECRET;
    expect(getMcpRelaySecret).toThrow('independent');
    delete process.env.MCP_RELAY_SECRET;
    expect(getMcpRelaySecret).toThrow('independent');
  });
  it('has unique tools and strict discovery schemas', () => {
    const tools = describeTools();
    expect(new Set(tools.map(t => t.name)).size).toBe(tools.length);
    for (const tool of tools) expect(tool.inputSchema.additionalProperties).toBe(false);
  });
});

describe('OAuth connection lifecycle', () => {
  it('strips unsupported OAuth extensions while retaining recognized authorization checks', async () => {
    const instance = await app();
    const response = await instance.inject(`/mcp/oauth/authorize?${new URLSearchParams({ ...auth, prompt: 'consent', nonce: 'client-nonce', teamId: 'other-team' })}`);
    expect(response.statusCode).toBe(302);
    const redirect = new URL(String(response.headers.location));
    expect(redirect.pathname).toBe('/mcp/connect');
    expect(redirect.searchParams.get('client_id')).toBe(auth.client_id);
    for (const key of ['prompt', 'nonce', 'teamId']) expect(redirect.searchParams.has(key)).toBe(false);
  });
  it.each(['revoked', 'expired', 'wrong-resource', 'removed-member', 'suspended', 'session-ended'])('rejects %s connections', async reason => {
    if (reason === 'revoked') grant.revokedAt = new Date();
    if (reason === 'expired') grant.accessExpiresAt = new Date(0);
    if (reason === 'wrong-resource') grant.resource = 'https://another.example/mcp';
    if (reason === 'removed-member') mocks.db.teamMember.findFirst.mockResolvedValue(null);
    if (reason === 'suspended') mocks.db.user.findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 0 });
    if (reason === 'session-ended') mocks.db.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 1 });
    expect(await authenticateMcpToken(token, config)).toBeNull();
  });
  it('caps public client registrations across the whole service', async () => {
    const instance = await app();
    mocks.db.mcpOAuthClient.count.mockResolvedValue(10_000);
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/register', payload: { redirect_uris: [auth.redirect_uri] } });
    expect(response.statusCode).toBe(503);
    expect(mocks.db.mcpOAuthClient.create).not.toHaveBeenCalled();
  });
  it('rejects consent scopes the client did not request', async () => {
    const instance = await app();
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/consent', headers: { origin: config.webOrigin },
      payload: { authorization: { ...auth, scope: 'cmf:read' }, teamId: 'team-1', scopes: ['cmf:read', 'cmf:write'] } });
    expect(response.statusCode).toBe(400);
    expect(mocks.db.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });
  it('discovers PKCE and rejects unsafe redirect metadata', async () => {
    const instance = await app();
    expect((await instance.inject('/.well-known/oauth-authorization-server')).json().code_challenge_methods_supported).toEqual(['S256']);
    expect((await instance.inject('/.well-known/oauth-protected-resource/mcp')).json().resource).toBe(config.resource);
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/register', payload: { redirect_uris: ['http://evil.example/callback'] } });
    expect(response.statusCode).toBe(400);
    expect(mocks.db.mcpOAuthClient.create).not.toHaveBeenCalled();
  });
  it('pins redirect URI, resource and S256 before redirecting a browser', async () => {
    const instance = await app();
    for (const changes of [{ redirect_uri: 'https://evil.example' }, { resource: 'https://evil.example/mcp' }, { code_challenge_method: 'plain' }]) {
      const response = await instance.inject(`/mcp/oauth/authorize?${new URLSearchParams({ ...auth, ...changes })}`);
      expect(response.statusCode).toBe(400); expect(response.headers.location).toBeUndefined();
    }
    expect((await instance.inject(`/mcp/oauth/authorize?${new URLSearchParams(auth)}`)).headers.location).toContain('http://localhost:3000/mcp/connect?');
  });
  it('requires authenticated consent, a valid origin and active membership of the selected team', async () => {
    const instance = await app();
    const request = { method: 'POST' as const, url: '/mcp/oauth/consent', payload: { authorization: auth, teamId: 'other-team', scopes: ['cmf:read'] } };
    expect((await instance.inject(request)).statusCode).toBe(403);
    mocks.db.teamMember.findFirst.mockResolvedValue(null);
    expect((await instance.inject({ ...request, headers: { origin: config.webOrigin } })).statusCode).toBe(403);
    expect(mocks.db.teamMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', teamId: 'other-team', status: 'active' } }));
    expect(mocks.db.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });
  it('creates a workspace-bound grant and stores only the code digest after explicit consent', async () => {
    const instance = await app(); mocks.db.mcpOAuthGrant.create.mockResolvedValue(grant);
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/consent', headers: { origin: config.webOrigin }, payload: { authorization: auth, teamId: 'team-1', scopes: ['cmf:read', 'cmf:write'] } });
    expect(response.statusCode).toBe(200);
    const redirect = new URL(response.json().redirectUrl);
    expect(redirect.origin).toBe('https://agent.example'); expect(redirect.searchParams.get('state')).toBe('user-state');
    const stored = mocks.db.mcpOAuthGrant.create.mock.calls[0][0].data;
    expect(stored.codes.create.hash).toBe(digest(redirect.searchParams.get('code')!));
    expect(stored.teamId).toBe('team-1');
    expect(JSON.stringify(stored)).not.toContain(redirect.searchParams.get('code'));
  });
  it('exchanges a PKCE code once and rejects its replay', async () => {
    const instance = await app(); grant.accessTokenHash = null;
    mocks.db.mcpOAuthCode.findUnique.mockResolvedValue({ hash: digest('code'), grant, redirectUri: auth.redirect_uri, codeChallenge: auth.code_challenge, expiresAt: new Date(Date.now() + 60000) });
    mocks.db.mcpOAuthCode.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    const input = { grant_type: 'authorization_code', client_id: auth.client_id, resource: config.resource, code: 'code', redirect_uri: auth.redirect_uri, code_verifier: verifier };
    expect((await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: { ...input, code_verifier: 'x'.repeat(43) } })).statusCode).toBe(400);
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: input });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(grant.accessTokenHash).toBe(digest(response.json().access_token));
    expect((await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: input })).statusCode).toBe(400);
  });
  it('rotates refresh tokens and rejects the old token', async () => {
    const instance = await app();
    const input = { grant_type: 'refresh_token', client_id: 'client-1', resource: config.resource, refresh_token: 'refresh' };
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: input });
    expect(response.statusCode).toBe(200);
    expect(grant.refreshTokenHash).toBe(digest(response.json().refresh_token));
    mocks.db.mcpOAuthRefreshUse.findUnique.mockResolvedValue({ grant, grantId: grant.id });
    expect((await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: input })).statusCode).toBe(400);
    expect(grant.revokedAt).toBeInstanceOf(Date);
    expect(grant.accessTokenHash).toBeNull();
  });
  it('retains replay evidence for the grant lifetime and cleans up only expired digests', async () => {
    const instance = await app();
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: {
      grant_type: 'refresh_token', client_id: 'client-1', resource: config.resource, refresh_token: 'refresh',
    } });
    expect(response.statusCode).toBe(200);
    expect(mocks.db.mcpOAuthRefreshUse.create).toHaveBeenCalledWith({ data: {
      hash: digest('refresh'), grantId: grant.id, expiresAt: grant.expiresAt,
    } });
    expect(mocks.db.mcpOAuthRefreshUse.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: expect.any(Date) } } });
    const cutoff = mocks.db.mcpOAuthRefreshUse.deleteMany.mock.calls[0][0].where.expiresAt.lte;
    expect(cutoff.getTime()).toBeLessThan(grant.expiresAt.getTime());
  });
  it('does not fail token issuance if expired-digest cleanup is unavailable', async () => {
    const instance = await app();
    mocks.db.mcpOAuthRefreshUse.deleteMany.mockRejectedValue(new Error('Cleanup unavailable'));
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: {
      grant_type: 'refresh_token', client_id: 'client-1', resource: config.resource, refresh_token: 'refresh',
    } });
    expect(response.statusCode).toBe(200);
  });
  it('revokes the token family when a concurrent refresh has already consumed the credential', async () => {
    const instance = await app();
    const winningAccess = 'w'.repeat(43);
    mocks.db.mcpOAuthGrant.updateMany.mockImplementationOnce(async () => {
      grant.accessTokenHash = digest(winningAccess); grant.refreshTokenHash = digest('winning-refresh');
      return { count: 0 };
    });
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/token', payload: {
      grant_type: 'refresh_token', client_id: 'client-1', resource: config.resource, refresh_token: 'refresh',
    } });
    expect(response.statusCode).toBe(400);
    expect(grant.revokedAt).toBeInstanceOf(Date);
    expect(grant.accessTokenHash).toBeNull();
    expect(grant.refreshTokenHash).toBeNull();
    expect(await authenticateMcpToken(winningAccess, config)).toBeNull();
  });
  it('revokes both credentials and limits browser disconnect to its owner', async () => {
    const instance = await app();
    await instance.inject({ method: 'POST', url: '/mcp/oauth/revoke', payload: { client_id: 'client-1', token } });
    expect(mocks.db.mcpOAuthGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessTokenHash: null, refreshTokenHash: null }) }));
    await instance.inject({ method: 'DELETE', url: '/mcp/connections/grant-1', headers: { origin: config.webOrigin } });
    expect(mocks.db.mcpOAuthGrant.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'grant-1', userId: 'user-1' } }));
  });
  it('validates configuration and scopes without accepting production HTTP', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('MCP_PUBLIC_URL', 'http://localhost:3001/mcp');
    expect(getMcpConfig).toThrow('HTTPS'); expect(() => parseScopes('cmf:admin')).toThrow();
    expect(redirectUriSchema.safeParse('https://agent.example/cb#fragment').success).toBe(false);
    expect(redirectUriSchema.safeParse('http://127.0.0.1:4321/cb').success).toBe(true);
  });
  it('lists only the caller’s redeemed connections without exposing credentials', async () => {
    const instance = await app();
    mocks.db.mcpOAuthGrant.findMany.mockResolvedValue([{ id: 'grant-1', teamId: 'team-1', scopes: ['cmf:read'], client: { name: 'Agent' } }]);
    mocks.db.team.findMany.mockResolvedValue([{ id: 'team-1', name: 'My team' }]);
    const response = await instance.inject('/mcp/connections');
    expect(response.statusCode).toBe(200);
    expect(response.json().connections[0].teamName).toBe('My team');
    const query = mocks.db.mcpOAuthGrant.findMany.mock.calls[0][0];
    expect(query.where.userId).toBe('user-1');
    expect(query.select.accessTokenHash).toBeUndefined();
    expect(query.select.refreshTokenHash).toBeUndefined();
  });
  it('requires a signed-in user to manage connections', async () => {
    const instance = await app(); mocks.getToken.mockResolvedValue(null);
    expect((await instance.inject('/mcp/connections')).statusCode).toBe(401);
    expect(mocks.db.mcpOAuthGrant.findMany).not.toHaveBeenCalled();
  });
  it('marks a change left running by a crashed process as uncertain, and only once it is clearly stale', async () => {
    const now = new Date('2026-11-08T12:00:00Z');
    await cleanupMcpRecords(now);
    const stuck = mocks.db.mcpToolAction.updateMany.mock.calls[0]![0];
    expect(stuck.where.status).toBe('RUNNING');
    expect(stuck.where.startedAt.lt).toEqual(new Date('2026-11-08T11:50:00Z'));
    expect(stuck.data).toEqual({ status: 'UNKNOWN', completedAt: now });
    expect(mocks.db.mcpToolAction.deleteMany).toHaveBeenCalled();
  });
});
