import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRoleRank } from '@/lib/permissions';
import { MCP_OPERATIONS, MCP_INSTRUCTIONS, type McpOperation } from './catalog';
import { getMcpConfig, getMcpRelaySecret, type McpConfig } from './config';
import { authenticateMcpToken, registerMcpOAuth, type McpPrincipal } from './oauth';
import { checkRateLimit } from '@/lib/rateLimit';
import { executeReviewedAction, type McpOutcome } from './actions';
import { cleanupMcpRecords } from './maintenance';
import { readMcpApi } from './reads';
import { boundedResponseText } from './response';

function identityHeaders(principal: McpPrincipal, method: string, path: string) {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for MCP execution');
  const payload = JSON.stringify(['v2', timestamp, nonce, method, path, principal.userId, principal.email, principal.enterpriseRole]);
  return {
    'x-craftmyfunnel-user-id': principal.userId, 'x-craftmyfunnel-user-email': principal.email,
    'x-craftmyfunnel-user-role': principal.enterpriseRole, 'x-craftmyfunnel-auth-ts': timestamp,
    'x-craftmyfunnel-auth-nonce': nonce,
    'x-craftmyfunnel-auth-signature-v2': createHmac('sha256', secret).update(payload).digest('hex'),
    cookie: `convo-workspace-id=${encodeURIComponent(principal.teamId)}`,
    'x-cmf-mcp-workspace': principal.teamId,
  };
}

export function describeTools() {
  return MCP_OPERATIONS.map(op => ({
    name: op.name, title: op.name.replaceAll('_', ' '), description: op.description,
    inputSchema: z.toJSONSchema(op.schema, { unrepresentable: 'any' }) as any,
    annotations: { readOnlyHint: op.method === 'GET', destructiveHint: op.method !== 'GET',
      idempotentHint: op.method === 'GET', openWorldHint: op.scope === 'cmf:generate' || op.name === 'record_meeting' },
    _meta: { securitySchemes: [{ type: 'oauth2', scopes: [op.scope] }] },
    securitySchemes: [{ type: 'oauth2', scopes: [op.scope] }],
  }));
}

async function invoke(app: FastifyInstance, config: McpConfig, principal: McpPrincipal, op: McpOperation, args: Record<string, any>, actionId?: string) {
  if (op.owner === 'web') {
    // This is a first-party, one-use delegation capability. Never forward the
    // customer's OAuth access token or mint a browser session for the agent.
    const timestamp = Date.now();
    const nonce = randomUUID();
    const payload = JSON.stringify({ operation: op.name, args, grantId: principal.grantId, timestamp, nonce, ...(actionId ? { actionId } : {}) });
    const signingSecret = getMcpRelaySecret();
    const target = new URL('/api/mcp/execute', process.env.MCP_WEB_INTERNAL_ORIGIN || config.webOrigin);
    // Configuration only; no user input controls the host or path.
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password ||
      (process.env.NODE_ENV === 'production' && target.protocol !== 'https:')) throw new Error('Invalid MCP web origin');
    const admission = JSON.stringify(['mcp-admission-v1', timestamp, principal.grantId, 'POST', '/api/mcp/execute']);
    const response = await fetch(target, { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-cmf-mcp-signature': createHmac('sha256', signingSecret).update(payload).digest('hex'),
        'x-cmf-mcp-admission': `${timestamp}.${principal.grantId}.${createHmac('sha256', signingSecret).update(admission).digest('hex')}` },
      body: payload, signal: AbortSignal.timeout(60_000) });
    return { status: response.status, payload: await boundedResponseText(response) };
  }
  if (op.method === 'GET') {
    const bounded = await readMcpApi(op.name, principal.teamId, args);
    if (bounded) return bounded;
  }
  const path = op.path(args);
  const response = await app.inject({ method: op.method, url: path,
    headers: { ...identityHeaders(principal, op.method, new URL(path, config.issuer).pathname),
      ...(op.method !== 'GET' ? { 'content-type': 'application/json' } : {}) },
    ...(op.body ? { payload: JSON.stringify(op.body(args)) } : {}),
  });
  return { status: response.statusCode, payload: response.body };
}

export async function executeMcpTool(app: FastifyInstance, config: McpConfig, principal: McpPrincipal,
  name: string, input: unknown) {
  const op = MCP_OPERATIONS.find(item => item.name === name);
  if (!op) throw new McpError(ErrorCode.InvalidParams, 'Unknown tool');
  if (!principal.scopes.includes(op.scope) || getRoleRank(principal.role) < getRoleRank(op.role)) {
    return { isError: true, content: [{ type: 'text' as const, text: 'This connection or current workspace role does not permit that action.' }],
      ...(!principal.scopes.includes(op.scope) ? { _meta: { 'mcp/www_authenticate': [
        `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", error_description="Reconnect to grant this permission", scope="${op.scope}"`,
      ] } } : {}),
      structuredContent: { status: 403, error: 'insufficient_permissions' } };
  }
  const parsed = op.schema.safeParse(input ?? {});
  if (!parsed.success) throw new McpError(ErrorCode.InvalidParams, 'Invalid tool arguments', parsed.error.issues.map(i => ({ path: i.path, message: i.message })));
  const { requestId, ...args } = parsed.data as Record<string, any>;
  const perform = async (actionId?: string): Promise<McpOutcome> => {
  const started = Date.now();
  // No prompts, credentials, lead PII or results in the audit metadata.
  const audit = (action: string, metadata: Record<string, string | number>) => prisma.auditLog.create({ data: {
    actorId: principal.userId, orgId: principal.teamId, entity: 'McpOAuthGrant', entityId: principal.grantId,
    action, metadata: { tool: op.name, ...(actionId ? { actionId } : {}), ...metadata },
  } });
  if (op.method !== 'GET') await audit('MCP_TOOL_REQUESTED', {});
  try {
    const response = await invoke(app, config, principal, op, args, actionId);
    await audit('MCP_TOOL_COMPLETED', { status: response.status, durationMs: Date.now() - started });
    let data: unknown;
    try { data = JSON.parse(response.payload); } catch { data = { message: response.status < 400 ? response.payload : 'Request failed' }; }
    if (response.status >= 500) data = { error: 'The operation failed. Check the app state before retrying a change.' };
    const oversized = Buffer.byteLength(JSON.stringify(data)) > 128_000;
    if (oversized) data = { error: 'Result exceeds the agent response limit. Use narrower filters or inspect this record in CraftMyFunnel.', operationStatus: response.status };
    return { isError: response.status >= 400 || oversized, content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: { status: response.status, data } };
  } catch {
    app.log.warn({ tool: op.name }, 'MCP tool failed; arguments and credentials omitted');
    return { isError: true, content: [{ type: 'text' as const, text: 'Operation outcome is uncertain. Inspect CraftMyFunnel before retrying a change.' }],
      structuredContent: { status: 503, error: 'operation_outcome_uncertain' } };
  }
  };
  return op.method === 'GET' ? perform() : executeReviewedAction(config, principal, op.name, requestId, args, perform);
}

export function registerMcp(app: FastifyInstance, config: McpConfig = getMcpConfig()) {
  registerMcpOAuth(app, config);
  let maintenance: ReturnType<typeof setInterval> | undefined;
  app.addHook('onReady', async () => {
    maintenance = setInterval(() => { void cleanupMcpRecords().catch(() => app.log.warn('MCP cleanup failed; credentials and arguments omitted')); }, 30 * 60_000);
    maintenance.unref();
  });
  app.addHook('onClose', async () => { if (maintenance) clearInterval(maintenance); });
  const challenge = `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource/mcp"`;
  const authenticated = new WeakMap<FastifyRequest, { principal: McpPrincipal | null; unavailable: boolean }>();
  app.route({ method: ['GET', 'POST', 'DELETE'], url: '/mcp', bodyLimit: 65_536,
    onRequest: async (req, reply) => {
      const limit = await checkRateLimit(`ip:${req.ip}`, { maxRequests: 10_000, windowMs: 60_000 }, 'mcp-ingress');
      if (!limit.allowed) return reply.code(429).header('Retry-After', Math.max(1, Math.ceil((limit.resetTime - Date.now()) / 1000))).send({ error: 'Too many requests' });
    },
    config: { rateLimit: { max: 60, timeWindow: '1 minute', keyGenerator: async (req: FastifyRequest) => {
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      try {
        const principal = token ? await authenticateMcpToken(token, config) : null;
        authenticated.set(req, { principal, unavailable: false });
        return principal ? `mcp:user:${principal.userId}:team:${principal.teamId}` : `mcp:ip:${req.ip}`;
      } catch {
        authenticated.set(req, { principal: null, unavailable: true });
        return `mcp:ip:${req.ip}`;
      }
    } } },
    handler: async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (req.headers.origin && req.headers.origin !== config.webOrigin && req.headers.origin !== config.issuer) {
        return reply.code(403).send({ error: 'Invalid origin' });
      }
      const authorization = req.headers.authorization;
      const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      let principal: McpPrincipal | null = authenticated.get(req)?.principal || null;
      if (authenticated.get(req)?.unavailable) return reply.code(503).send({ error: 'Authorization service unavailable' });
      try { if (token && !authenticated.has(req)) principal = await authenticateMcpToken(token, config); }
      catch { return reply.code(503).send({ error: 'Authorization service unavailable' }); }
      if (principal) {
        const limit = await checkRateLimit(`user:${principal.userId}:team:${principal.teamId}`, { maxRequests: 60, windowMs: 60_000 }, 'mcp-tools');
        if (!limit.allowed) return reply.code(429).header('Retry-After', Math.max(1, Math.ceil((limit.resetTime - Date.now()) / 1000))).send({ error: 'Too many requests' });
      }
      const method = (req.body as { method?: string } | undefined)?.method;
      const discovery = req.method === 'POST' && ['initialize', 'ping', 'notifications/initialized'].includes(method || '');
      if ((authorization && !principal) || (!principal && !discovery)) {
        const authChallenge = `${challenge}, error="invalid_token", error_description="Connect your CraftMyFunnel account to continue"`;
        const id = (req.body as { id?: unknown } | undefined)?.id;
        const authResult = { isError: true, content: [{ type: 'text', text: 'Authentication required. Connect your CraftMyFunnel account.' }],
          _meta: { 'mcp/www_authenticate': [authChallenge] } };
        return reply.code(401).header('WWW-Authenticate', authChallenge).send(method === 'tools/call' &&
          (typeof id === 'number' || typeof id === 'string') ? { jsonrpc: '2.0', id, result: authResult } : { error: 'invalid_token' });
      }
      // A fresh transport/server per request avoids shared user/session state.
      const server = new Server({ name: 'craftmyfunnel', version: '1.0.0' }, { capabilities: { tools: {} }, instructions: MCP_INSTRUCTIONS });
      server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: describeTools() }));
      server.setRequestHandler(CallToolRequestSchema, async request => {
        if (!principal) throw new McpError(ErrorCode.InvalidRequest, 'OAuth authorization required');
        return executeMcpTool(app, config, principal, request.params.name, request.params.arguments);
      });
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      try {
        await server.connect(transport);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
        const response = await transport.handleRequest(new Request(config.resource, {
          method: req.method, headers, ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
        }));
        response.headers.forEach((value, key) => { if (!['content-length', 'transfer-encoding'].includes(key)) reply.header(key, value); });
        return reply.code(response.status).send(response.body ? await response.text() : undefined);
      } finally { await server.close(); }
    },
  });
}
