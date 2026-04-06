import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

// Middleware
fastify.register(helmet);
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) {
      const allowInDev = process.env.NODE_ENV !== 'production';
      return cb(null, allowInDev);
    }
    return cb(null, allowedOrigins.includes(origin));
  }
});

fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req: any, body: Buffer, done) => {
  req.rawBody = body;
  done(null, body);
});

/**
 * Adapter to bridge Next.js Route Handlers to Fastify
 * It creates a mock Request object compatible with what Next.js handlers expect.
 */
const nextAdapter = (handler: any) => async (request: any, reply: any) => {
  try {
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
    const body = (method === 'GET' || method === 'HEAD') ? undefined : request.rawBody;
    const nextReq = new Request(url.toString(), { method, headers, body } as any);

    const response = await handler(nextReq as any);
    
    const status = response.status || 200;
    const contentType = response.headers?.get?.('content-type') || '';

    const setCookies = response.headers?.getSetCookie?.() || [];
    if (setCookies.length) {
      reply.header('set-cookie', setCookies);
    } else {
      const single = response.headers?.get?.('set-cookie');
      if (single) reply.header('set-cookie', single);
    }

    if (response.headers?.forEach) {
      response.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === 'set-cookie') return;
        reply.header(key, value);
      });
    }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      reply.status(status).send(data);
      return;
    }

    if (contentType.startsWith('text/') || contentType.includes('application/xml') || contentType.includes('text/csv')) {
      const text = await response.text();
      reply.status(status).send(text);
      return;
    }

    if (response.body) {
      const buf = Buffer.from(await response.arrayBuffer());
      reply.status(status).send(buf);
      return;
    }

    reply.status(status).send();
  } catch (error: any) {
    fastify.log.error(error);
    reply.status(500).send({ ok: false, error: error.message || 'Internal Server Error' });
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
      fastify.log.info(`Registering [${method}] ${registeredPath}`);

      fastify.route({
        method: method as any,
        url: registeredPath,
        handler: nextAdapter(handler)
      });
    }
  }
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
