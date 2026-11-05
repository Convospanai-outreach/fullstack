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
import { TeamRole } from '@/lib/permissions';
import { verifyInternalAuthHeaders } from '@/lib/internalAuth';

const mocks = vi.hoisted(() => ({
  db: {
    mcpOAuthClient: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    mcpOAuthGrant: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    mcpOAuthCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
    mcpOAuthRefreshUse: { create: vi.fn(), findUnique: vi.fn() },
    team: { findMany: vi.fn() },
    teamMember: { findFirst: vi.fn(), findMany: vi.fn() }, user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() }, $transaction: vi.fn(),
  }, getToken: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: mocks.db }));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));

const config = { resource: 'http://localhost:3001/mcp', issuer: 'http://localhost:3001', webOrigin: 'http://localhost:3000' };
const verifier = 'v'.repeat(43);
const auth = { client_id: 'client-1', redirect_uri: 'https://agent.example/callback', response_type: 'code',
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  resource: config.resource, scope: 'cmf:read cmf:write cmf:generate', state: 'user-state' };
const principal = { grantId: 'grant-1', userId: 'user-1', teamId: 'team-1', scopes: ['cmf:read','cmf:write','cmf:generate'],
  role: TeamRole.MEMBER, email: 'test@example.com', enterpriseRole: 'SALES_USER' };
const token = 't'.repeat(43);
let grant: any;
let apps: ReturnType<typeof Fastify>[] = [];
async function app() {
  const instance = Fastify(); apps.push(instance); registerMcp(instance, config); await instance.ready(); return instance;
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret-for-mcp-tests';
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
  mocks.db.$transaction.mockImplementation(fn => fn(mocks.db));
  mocks.db.mcpOAuthGrant.updateMany.mockImplementation(async ({ where, data }: any) => {
    if (where.refreshTokenHash && where.refreshTokenHash !== grant.refreshTokenHash) return { count: 0 };
    Object.assign(grant, data); return { count: 1 };
  });
  mocks.getToken.mockResolvedValue({ sub: 'user-1', sessionVersion: 0 });
});
afterEach(async () => { await Promise.all(apps.map(instance => instance.close())); apps = []; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('remote MCP protocol and authorization', () => {
  it('supports real SDK initialize and discovery over HTTP without exposing account data', async () => {
    const instance = await app(); await instance.listen({ port: 0, host: '127.0.0.1' });
    const address = instance.server.address() as { port: number };
    const client = new Client({ name: 'test-client', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(MCP_OPERATIONS.length);
    expect(tools.tools.some(tool => tool.name === 'create_campaign')).toBe(true);
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    await client.close();
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
  it('uses the existing API path with a verified identity and a pinned workspace', async () => {
    const instance = Fastify(); apps.push(instance);
    await instance.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    instance.get('/pipeline/tasks', async req => ({ identity: verifyInternalAuthHeaders(req.headers, { method: 'GET', path: '/pipeline/tasks' })?.sub, cookie: req.headers.cookie }));
    const result = await executeMcpTool(instance, config, principal, 'list_tasks', {});
    expect(result.structuredContent).toMatchObject({ status: 200, data: { identity: 'user-1', cookie: 'convo-workspace-id=team-1' } });
  });
  it('rejects privilege escalation and caller-supplied team IDs', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'create_task', { title: 'task', teamId: 'other-team' })).rejects.toThrow('Invalid tool arguments');
    const result = await executeMcpTool(instance, config, { ...principal, scopes: ['cmf:read'] }, 'create_task', { title: 'task' });
    expect(result.structuredContent.status).toBe(403);
    expect(result._meta?.['mcp/www_authenticate'][0]).toContain('scope="cmf:write"');
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });
  it('rechecks current role independently of OAuth scopes', async () => {
    const instance = await app();
    const result = await executeMcpTool(instance, config, { ...principal, role: TeamRole.VIEWER }, 'create_task', { title: 'task' });
    expect(result.structuredContent.status).toBe(403);
  });
  it('forbids status activation and arbitrary targets', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'update_campaign_details', { id: 'campaign', status: 'active' })).rejects.toThrow();
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
      await expect(executeMcpTool(instance, config, principal, 'update_lead', { id: 'lead-1', changes }))
        .rejects.toThrow('Invalid tool arguments');
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects an empty lead update', async () => {
    const instance = await app();
    await expect(executeMcpTool(instance, config, principal, 'update_lead', { id: 'lead-1', changes: {} }))
      .rejects.toThrow('Invalid tool arguments');
  });
  it('advertises and relays the lead contact fields supported by the web PATCH handler', async () => {
    const instance = await app();
    const changes = { fullName: 'Updated', email: 'updated@example.com', linkedIn: 'https://www.linkedin.com/in/updated', company: 'Example' };
    const tool = describeTools().find(item => item.name === 'update_lead')!;
    expect(Object.keys(tool.inputSchema.properties.changes.properties).sort()).toEqual(Object.keys(changes).sort());
    expect(tool.inputSchema.properties.changes.additionalProperties).toBe(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'lead-1', ...changes }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await executeMcpTool(instance, config, principal, 'update_lead', { id: 'lead-1', changes });
    expect(result.structuredContent.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args).toEqual({ id: 'lead-1', changes });
  });
  it('preserves insufficient-credit status without exposing prompts in audit rows', async () => {
    const instance = Fastify(); apps.push(instance);
    instance.post('/ai/preview', async (_req, reply) => reply.code(402).send({ error: 'Insufficient credits' }));
    const result = await executeMcpTool(instance, config, principal, 'generate_message_preview', { goal: 'private customer goal' });
    expect(result.isError).toBe(true); expect(result.structuredContent.status).toBe(402);
    expect(JSON.stringify(mocks.db.auditLog.create.mock.calls)).not.toContain('private customer goal');
  });
  it('sends web operations to a fixed signed first-party relay without the OAuth token', async () => {
    const instance = await app();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'campaign' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await executeMcpTool(instance, config, principal, 'create_campaign', { name: 'Draft', icpId: 'icp-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/api/mcp/execute');
    expect(init.headers.authorization).toBeUndefined();
    expect(init.headers['x-cmf-mcp-signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(init.body)).toMatchObject({ operation: 'create_campaign', grantId: 'grant-1', args: { icpId: 'icp-1' } });
  });
  it('has unique tools and strict discovery schemas', () => {
    const tools = describeTools();
    expect(new Set(tools.map(t => t.name)).size).toBe(tools.length);
    for (const tool of tools) expect(tool.inputSchema.additionalProperties).toBe(false);
  });
});

describe('OAuth connection lifecycle', () => {
  it.each(['revoked', 'expired', 'wrong-resource', 'removed-member', 'suspended', 'session-ended'])('rejects %s connections', async reason => {
    if (reason === 'revoked') grant.revokedAt = new Date();
    if (reason === 'expired') grant.accessExpiresAt = new Date(0);
    if (reason === 'wrong-resource') grant.resource = 'https://another.example/mcp';
    if (reason === 'removed-member') mocks.db.teamMember.findFirst.mockResolvedValue(null);
    if (reason === 'suspended') mocks.db.user.findUnique.mockResolvedValue({ suspendedAt: new Date(), sessionVersion: 0 });
    if (reason === 'session-ended') mocks.db.user.findUnique.mockResolvedValue({ suspendedAt: null, sessionVersion: 1 });
    expect(await authenticateMcpToken(token, config)).toBeNull();
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
    const request = { method: 'POST' as const, url: '/mcp/oauth/consent', payload: { authorization: auth, teamId: 'other-team' } };
    expect((await instance.inject(request)).statusCode).toBe(403);
    mocks.db.teamMember.findFirst.mockResolvedValue(null);
    expect((await instance.inject({ ...request, headers: { origin: config.webOrigin } })).statusCode).toBe(403);
    expect(mocks.db.teamMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', teamId: 'other-team', status: 'active' } }));
    expect(mocks.db.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });
  it('creates a workspace-bound grant and stores only the code digest after explicit consent', async () => {
    const instance = await app(); mocks.db.mcpOAuthGrant.create.mockResolvedValue(grant);
    const response = await instance.inject({ method: 'POST', url: '/mcp/oauth/consent', headers: { origin: config.webOrigin }, payload: { authorization: auth, teamId: 'team-1' } });
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
});
