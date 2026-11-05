import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticateInternalRequest, internalAuthPath } from '@/lib/internalAuth';
import { getRoleRank, TeamRole } from '@/lib/permissions';
import { MCP_SCOPES, parseScopes, redirectUriSchema, type McpConfig } from './config';

const ACCESS_MS = 60 * 60 * 1000;
const GRANT_MS = 30 * 24 * 60 * 60 * 1000;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const challengeFor = (value: string) => createHash('sha256').update(value).digest('base64url');
const authorizationSchema = z.object({
  client_id: z.string().min(1).max(200),
  redirect_uri: redirectUriSchema,
  response_type: z.literal('code'),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal('S256'),
  resource: z.string().max(2048),
  scope: z.string().max(200).optional(),
  state: z.string().min(1).max(2048),
}).strict();
type Authorization = z.infer<typeof authorizationSchema>;
export type McpPrincipal = {
  grantId: string; userId: string; teamId: string; scopes: string[];
  email: string; enterpriseRole: string; role: TeamRole;
};

async function account(userId: string, teamId: string, sessionVersion?: number) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: {
      email: true, enterpriseRole: true, suspendedAt: true, sessionVersion: true,
    } }),
    prisma.teamMember.findFirst({ where: { userId, teamId, status: 'active' }, select: { role: true } }),
  ]);
  if (!user || user.suspendedAt || !membership || !getRoleRank(membership.role as TeamRole) ||
    (sessionVersion !== undefined && user.sessionVersion !== sessionVersion)) return null;
  return { user, role: membership.role as TeamRole };
}

export async function authenticateMcpToken(token: string, config: McpConfig): Promise<McpPrincipal | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const grant = await prisma.mcpOAuthGrant.findUnique({ where: { accessTokenHash: digest(token) } });
  if (!grant || grant.revokedAt || grant.resource !== config.resource ||
    grant.accessExpiresAt <= new Date() || grant.expiresAt <= new Date()) return null;
  const current = await account(grant.userId, grant.teamId, grant.sessionVersion);
  return current ? {
    grantId: grant.id, userId: grant.userId, teamId: grant.teamId, scopes: grant.scopes,
    role: current.role, email: current.user.email || '', enterpriseRole: current.user.enterpriseRole,
  } : null;
}

async function browserUser(req: FastifyRequest) {
  const session = process.env.NEXTAUTH_SECRET
    ? await getToken({ req: req.raw as any, secret: process.env.NEXTAUTH_SECRET }) : null;
  const internal = await authenticateInternalRequest(req.headers, { method: req.method, path: internalAuthPath(req.url) });
  const userId = session?.sub || internal?.sub;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, sessionVersion: true } });
  if (!user || user.suspendedAt || (session && (session.sessionVersion ?? 0) !== user.sessionVersion)) return null;
  return userId;
}

async function validateAuthorization(input: unknown, config: McpConfig): Promise<Authorization> {
  const request = authorizationSchema.parse(input);
  if (request.resource !== config.resource) throw new Error('invalid_target');
  parseScopes(request.scope);
  const client = await prisma.mcpOAuthClient.findUnique({ where: { id: request.client_id } });
  if (!client || !client.redirectUris.includes(request.redirect_uri)) throw new Error('invalid_client');
  return request;
}

export function registerMcpOAuth(app: FastifyInstance, config: McpConfig) {
  const metadata = {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/mcp/oauth/authorize`,
    token_endpoint: `${config.issuer}/mcp/oauth/token`,
    registration_endpoint: `${config.issuer}/mcp/oauth/register`,
    revocation_endpoint: `${config.issuer}/mcp/oauth/revoke`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'],
    scopes_supported: [...MCP_SCOPES],
  };
  app.get('/.well-known/oauth-authorization-server', async () => metadata);
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    app.get(path, async () => ({ resource: config.resource, authorization_servers: [config.issuer],
      scopes_supported: [...MCP_SCOPES], bearer_methods_supported: ['header'], resource_name: 'CraftMyFunnel' }));
  }

  // Encapsulation keeps form parsing and no-store headers local to OAuth, not webhooks.
  app.register(async oauth => {
    oauth.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
      const entries = [...new URLSearchParams(String(body)).entries()];
      if (new Set(entries.map(([key]) => key)).size !== entries.length) return done(new Error('Duplicate form parameters'));
      done(null, Object.fromEntries(entries));
    });
    oauth.addHook('onRequest', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
    const limits = { bodyLimit: 16_384, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
    oauth.post('/mcp/oauth/register', limits, async (req, reply) => {
      const parsed = z.object({
        client_name: z.string().min(1).max(150).default('MCP agent'),
        redirect_uris: z.array(redirectUriSchema).min(1).max(10),
        token_endpoint_auth_method: z.literal('none').default('none'),
        grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
        response_types: z.array(z.literal('code')).optional(),
      }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_client_metadata' });
      const client = await prisma.mcpOAuthClient.create({ data: {
        name: parsed.data.client_name, redirectUris: parsed.data.redirect_uris,
      } });
      return reply.code(201).send({ client_id: client.id, client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name, redirect_uris: client.redirectUris, token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
    });

    oauth.get('/mcp/oauth/authorize', limits, async (req, reply) => {
      try {
        const auth = await validateAuthorization(req.query, config);
        return reply.redirect(`${config.webOrigin}/mcp/connect?${new URLSearchParams(auth as Record<string, string>)}`);
      } catch { return reply.code(400).send({ error: 'invalid_request' }); }
    });

    oauth.get('/mcp/oauth/consent', limits, async (req, reply) => {
      const userId = await browserUser(req);
      if (!userId) return reply.code(401).send({ error: 'Sign in to CraftMyFunnel to connect an agent' });
      try {
        const auth = await validateAuthorization(req.query, config);
        const [client, memberships] = await Promise.all([
          prisma.mcpOAuthClient.findUniqueOrThrow({ where: { id: auth.client_id } }),
          prisma.teamMember.findMany({ where: { userId, status: 'active' }, select: { teamId: true, role: true, team: { select: { name: true } } } }),
        ]);
        return { client: { name: client.name, redirectUri: auth.redirect_uri }, scopes: parseScopes(auth.scope),
          workspaces: memberships.map(m => ({ id: m.teamId, name: m.team.name, role: m.role })) };
      } catch { return reply.code(400).send({ error: 'Invalid connection request. Start again from your agent.' }); }
    });

    oauth.post('/mcp/oauth/consent', limits, async (req, reply) => {
      if (req.headers.origin !== config.webOrigin) return reply.code(403).send({ error: 'Invalid origin' });
      const userId = await browserUser(req);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const parsed = z.object({ authorization: authorizationSchema, teamId: z.string().min(1).max(100) }).strict().safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
      try {
        const auth = await validateAuthorization(parsed.data.authorization, config);
        const current = await account(userId, parsed.data.teamId);
        if (!current) return reply.code(403).send({ error: 'Active workspace membership required' });
        const scopes = parseScopes(auth.scope);
        if (scopes.some(scope => scope !== 'cmf:read') && getRoleRank(current.role) < getRoleRank(TeamRole.MEMBER)) {
          return reply.code(403).send({ error: 'This role can authorize read access only' });
        }
        const code = secret();
        const grant = await prisma.$transaction(async tx => {
          const created = await tx.mcpOAuthGrant.create({ data: {
            clientId: auth.client_id, userId, teamId: parsed.data.teamId, sessionVersion: current.user.sessionVersion,
            scopes, resource: config.resource, accessExpiresAt: new Date(0), expiresAt: new Date(Date.now() + GRANT_MS),
            codes: { create: { hash: digest(code), redirectUri: auth.redirect_uri, codeChallenge: auth.code_challenge,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000) } },
          } });
          await tx.auditLog.create({ data: { actorId: userId, orgId: created.teamId, action: 'MCP_CONNECTED',
            entity: 'McpOAuthGrant', entityId: created.id, metadata: { clientId: created.clientId, scopes } } });
          return created;
        });
        const redirect = new URL(auth.redirect_uri);
        redirect.searchParams.set('code', code);
        redirect.searchParams.set('state', auth.state);
        redirect.searchParams.set('iss', config.issuer);
        return { redirectUrl: redirect.href };
      } catch { return reply.code(400).send({ error: 'invalid_request' }); }
    });

    oauth.post('/mcp/oauth/token', limits, async (req, reply) => {
      const input = z.object({
        grant_type: z.enum(['authorization_code', 'refresh_token']), client_id: z.string().min(1).max(200),
        resource: z.literal(config.resource), code: z.string().max(100).optional(),
        redirect_uri: redirectUriSchema.optional(), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(),
        refresh_token: z.string().max(100).optional(),
      }).safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: 'invalid_request' });
      const data = input.data;
      const now = new Date();
      const code = data.code ? await prisma.mcpOAuthCode.findUnique({ where: { hash: digest(data.code) }, include: { grant: true } }) : null;
      const grant = data.grant_type === 'authorization_code' ? code?.grant
        : data.refresh_token ? await prisma.mcpOAuthGrant.findUnique({ where: { refreshTokenHash: digest(data.refresh_token) } }) : null;
      // A spent refresh credential must end the entire connection, including
      // the newer token an attacker may have obtained by winning the refresh.
      if (!grant && data.grant_type === 'refresh_token' && data.refresh_token) {
        const spent = await prisma.mcpOAuthRefreshUse.findUnique({ where: { hash: digest(data.refresh_token) }, include: { grant: true } });
        if (spent && spent.grant.clientId === data.client_id) {
          await prisma.mcpOAuthGrant.updateMany({ where: { id: spent.grantId }, data: {
            revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null,
          } });
        }
      }
      if (!grant || grant.clientId !== data.client_id || grant.resource !== data.resource || grant.revokedAt || grant.expiresAt <= now ||
        (data.grant_type === 'authorization_code' && (!code || code.expiresAt <= now || !data.code_verifier ||
          code.codeChallenge !== challengeFor(data.code_verifier) || code.redirectUri !== data.redirect_uri))) {
        return reply.code(400).send({ error: 'invalid_grant' });
      }
      if (!(await account(grant.userId, grant.teamId, grant.sessionVersion))) return reply.code(400).send({ error: 'invalid_grant' });
      const access = secret();
      const refresh = secret();
      const updated = await prisma.$transaction(async tx => {
        if (data.grant_type === 'authorization_code') {
          const consumed = await tx.mcpOAuthCode.deleteMany({ where: { hash: code!.hash, expiresAt: { gt: now } } });
          if (consumed.count !== 1) return false;
        }
        const result = await tx.mcpOAuthGrant.updateMany({ where: {
          id: grant.id, revokedAt: null, expiresAt: { gt: now },
          ...(data.grant_type === 'refresh_token' ? { refreshTokenHash: digest(data.refresh_token!) } : { accessTokenHash: null }),
        }, data: { accessTokenHash: digest(access), refreshTokenHash: digest(refresh), accessExpiresAt: new Date(Date.now() + ACCESS_MS) } });
        if (result.count === 1 && data.grant_type === 'refresh_token') {
          await tx.mcpOAuthRefreshUse.create({ data: { hash: digest(data.refresh_token!), grantId: grant.id, expiresAt: grant.expiresAt } });
        }
        return result.count === 1;
      });
      if (!updated) {
        // Reuse revokes the family even when detected by a lost concurrent
        // rotation: we cannot distinguish a client retry from a stolen token.
        if (data.grant_type === 'refresh_token') await prisma.mcpOAuthGrant.updateMany({ where: { id: grant.id },
          data: { revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null } });
        return reply.code(400).send({ error: 'invalid_grant' });
      }
      // Keep live replay evidence until the grant expires; prune expired rows
      // opportunistically without making token issuance depend on cleanup.
      void prisma.mcpOAuthRefreshUse.deleteMany({ where: { expiresAt: { lte: now } } }).catch(() => {});
      return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: ACCESS_MS / 1000, scope: grant.scopes.join(' ') };
    });

    oauth.post('/mcp/oauth/revoke', limits, async (req, reply) => {
      const parsed = z.object({ token: z.string().min(1).max(128), client_id: z.string().min(1).max(200) }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
      await prisma.mcpOAuthGrant.updateMany({ where: { clientId: parsed.data.client_id, OR: [
        { accessTokenHash: digest(parsed.data.token) }, { refreshTokenHash: digest(parsed.data.token) },
      ] }, data: { revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null } });
      return reply.code(200).send({});
    });

    oauth.get('/mcp/connections', limits, async (req, reply) => {
      const userId = await browserUser(req);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const connections = await prisma.mcpOAuthGrant.findMany({ where: { userId, revokedAt: null, accessTokenHash: { not: null }, expiresAt: { gt: new Date() } },
        select: { id: true, teamId: true, scopes: true, createdAt: true, expiresAt: true, client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 100 });
      const teams = await prisma.team.findMany({ where: { id: { in: connections.map(connection => connection.teamId) } }, select: { id: true, name: true } });
      return { serverUrl: config.resource, connections: connections.map(connection => ({ ...connection,
        teamName: teams.find(team => team.id === connection.teamId)?.name || 'Workspace' })) };
    });
    oauth.delete('/mcp/connections/:id', limits, async (req, reply) => {
      if (req.headers.origin !== config.webOrigin) return reply.code(403).send({ error: 'Invalid origin' });
      const userId = await browserUser(req);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const { id } = req.params as { id: string };
      const grant = await prisma.mcpOAuthGrant.findUnique({ where: { id } });
      if (grant?.userId === userId) await prisma.$transaction(async tx => {
        await tx.mcpOAuthGrant.updateMany({ where: { id, userId }, data: {
          revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null,
        } });
        await tx.auditLog.create({ data: { actorId: userId, orgId: grant.teamId, action: 'MCP_DISCONNECTED',
          entity: 'McpOAuthGrant', entityId: id, metadata: { clientId: grant.clientId } } });
      });
      return { ok: true };
    });
  });
}
