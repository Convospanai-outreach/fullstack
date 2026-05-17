import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { randomUUID } from 'crypto';
import { RequestContext } from '@/lib/requestContext';
import { getToken } from 'next-auth/jwt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length'
]);

function forwardSetCookieHeaders(responseHeaders: Headers, reply: any) {
  const getSetCookie = (responseHeaders as any).getSetCookie;
  if (typeof getSetCookie === 'function') {
    const cookies = getSetCookie.call(responseHeaders) as string[];
    if (cookies.length > 0) {
      reply.header('set-cookie', cookies);
      return;
    }
  }

  const singleCookie = responseHeaders.get('set-cookie');
  if (singleCookie) {
    reply.header('set-cookie', singleCookie);
  }
}

function forwardResponseHeaders(responseHeaders: Headers, reply: any) {
  responseHeaders.forEach((value: string, key: string) => {
    const normalized = key.toLowerCase();
    if (normalized === 'set-cookie') return;
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(normalized)) return;
    reply.header(key, value);
  });
}

// Middleware
fastify.register(helmet);
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isLoopbackDevOrigin(origin: string) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const parsed = new URL(origin);
    return (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.port === '3000' || parsed.port === '3001');
  } catch {
    return false;
  }
}

fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Allow server-to-server requests
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV !== 'production' && isLoopbackDevOrigin(origin)) {
        return cb(null, true);
      }
      return cb(null, false); // Deny by default instead of allowing all
    }
    return cb(null, allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLoopbackDevOrigin(origin)));
  }
});

fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req: any, body: Buffer, done) => {
  req.rawBody = body;
  done(null, body);
});

function getAdaptedRequestBody(request: any, headers: Headers) {
  if (request.rawBody !== undefined) {
    return request.rawBody;
  }

  if (request.body === undefined || request.body === null) {
    return undefined;
  }

  if (Buffer.isBuffer(request.body) || typeof request.body === 'string') {
    return request.body;
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return JSON.stringify(request.body);
}

/**
 * Adapter to bridge Next.js Route Handlers to Fastify
 */
const nextAdapter = (handler: any, registeredPath: string) => async (request: any, reply: any) => {
  try {
    const publicPaths = ["/webhooks", "/auth", "/test-auth", "/scheduler", "/extension", "/queue"];
    const isPublic = publicPaths.some(p => registeredPath.startsWith(p)) || registeredPath === '/';

    if (!isPublic) {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret && process.env.NODE_ENV === 'production') {
        reply.status(503).send({ error: 'Server misconfiguration' });
        return;
      }
      
      const token = await getToken({
        req: request.raw,
        secret
      });
      
      if (!token) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
      }
      
      if (registeredPath.startsWith('/admin')) {
        const role = token.enterpriseRole as string;
        if (role !== 'SYSTEM_ADMIN' && role !== 'ORG_ADMIN') {
          reply.status(403).send({ error: 'Forbidden: Admin access required' });
          return;
        }
      }
    }

    const proto = request.headers['x-forwarded-proto'] || request.protocol || 'http';
    const host = request.headers['x-forwarded-host'] || request.hostname;
    const url = new URL(request.url, `${proto}://${host}`);
    const headers = new Headers();
    Object.entries(request.headers || {}).forEach(([k, v]: any) => {
      if (typeof v === 'undefined') return;
      if (Array.isArray(v)) headers.set(k, v.join(','));
      else headers.set(k, String(v));
    });

    const method = request.method;
    const body = (method === 'GET' || method === 'HEAD') ? undefined : getAdaptedRequestBody(request, headers);
    const nextReq = new Request(url.toString(), { method, headers, body } as any);
    Object.defineProperty(nextReq, 'nextUrl', {
      value: url,
      configurable: true
    });

    const paramsPayload = Promise.resolve((request.params || {}) as Record<string, string>);
    const correlationId = headers.get('x-correlation-id') || randomUUID();
    const response = await RequestContext.run({ correlationId, request: nextReq }, async () => (
      handler.length >= 2
        ? await handler(nextReq as any, { params: paramsPayload })
        : await handler(nextReq as any)
    ));
    
    const status = response.status || 200;
    const contentType = response.headers?.get?.('content-type') || '';

    forwardSetCookieHeaders(response.headers, reply);
    forwardResponseHeaders(response.headers, reply);

    if (status === 204 || status === 304 || request.method === 'HEAD') {
      reply.status(status).send();
      return;
    }

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        reply.status(status).send(data);
      } catch {
        const payload = (await response.text()).trim();
        if (!payload) {
          reply.status(status).send();
          return;
        }
        reply.status(status).type('application/json').send(payload);
      }
      return;
    }

    if (contentType.startsWith('text/') || contentType.includes('application/xml') || contentType.includes('text/csv')) {
      const text = await response.text();
      if (!text) {
        reply.status(status).send();
        return;
      }
      reply.status(status).send(text);
      return;
    }

    if (!response.body) {
      reply.status(status).send();
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      reply.status(status).send();
      return;
    }
    reply.status(status).send(buffer);
  } catch (error: any) {
    fastify.log.error(error);
    const isProduction = process.env.NODE_ENV === 'production';
    reply.status(500).send({
      ok: false,
      error: isProduction ? 'Internal Server Error' : error.message || 'Internal Server Error',
    });
  }
};

type RouteModule = Record<string, unknown>;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

function collectRouteFiles(dir: string, prefix = ''): Array<{ fullPath: string; routePath: string }> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: Array<{ fullPath: string; routePath: string }> = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const routePath = path.join(prefix, entry.name === 'route.ts' ? '' : entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(fullPath, routePath));
      continue;
    }

    if (entry.name === 'route.ts') {
      files.push({ fullPath, routePath });
    }
  }

  return files;
}

async function loadRoutes(dir: string) {
  const routeFiles = collectRouteFiles(dir);

  const modules = await Promise.all(
    routeFiles.map(async ({ fullPath, routePath }) => ({
      fullPath,
      routePath,
      module: (await import(pathToFileURL(fullPath).href)) as RouteModule,
    }))
  );

  for (const { routePath, module } of modules) {
    for (const method of HTTP_METHODS) {
      const handler = module[method];
      if (!handler || typeof handler !== 'function') {
        continue;
      }

      const registeredPath = `/${routePath}`.replace(/\/$/, '') || '/';
      const fastifyPath = toFastifyRoutePath(registeredPath);
      fastify.log.info(`Registering [${method}] ${registeredPath}`);

      fastify.route({
        method: method as any,
        url: fastifyPath,
        handler: nextAdapter(handler, registeredPath)
      });
    }
  }
}

function toFastifyRoutePath(nextRoutePath: string) {
  return nextRoutePath
    .replace(/\[\.\.\.([^\]]+)\]/g, '*')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

const start = async () => {
  try {
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    
    // Auto-load routes
    const routesDir = path.join(__dirname, 'routes');
    if (fs.existsSync(routesDir)) {
      await loadRoutes(routesDir);
    }

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\x1b[32m✔ ConvoSpan Production API launched on port ${PORT}\x1b[0m`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
