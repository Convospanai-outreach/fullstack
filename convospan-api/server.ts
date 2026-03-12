import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || '*'
});

/**
 * Adapter to bridge Next.js Route Handlers to Fastify
 * It creates a mock Request object compatible with what Next.js handlers expect.
 */
const nextAdapter = (handler: any) => async (request: any, reply: any) => {
  try {
    // Basic mock of NextRequest/Request
    const nextReq = {
      json: async () => request.body,
      nextUrl: new URL(request.url, `http://${request.hostname}`),
      method: request.method,
      headers: request.headers,
      // Minimal implementation for Next.js compat
    };

    const response = await handler(nextReq as any);
    
    // Extract data from NextResponse
    const status = response.status || 200;
    const body = await response.json();
    
    reply.status(status).send(body);
  } catch (error: any) {
    fastify.log.error(error);
    reply.status(500).send({ ok: false, error: error.message || 'Internal Server Error' });
  }
};

/**
 * Recursively loads routes from the routes directory
 */
const loadRoutes = async (dir: string, prefix = '') => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const routePath = path.join(prefix, entry.name === 'route.ts' ? '' : entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      await loadRoutes(fullPath, routePath);
    } else if (entry.name === 'route.ts') {
      const module = await import(`file://${fullPath}`);
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        if (module[method]) {
          const registeredPath = `/${routePath}`.replace(/\/$/, '') || '/';
          fastify.log.info(`Registering [${method}] ${registeredPath}`);
          
          fastify.route({
            method: method as any,
            url: registeredPath,
            handler: nextAdapter(module[method])
          });
        }
      }
    }
  }
};

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
