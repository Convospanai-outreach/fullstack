import { z } from 'zod';

export const MCP_SCOPES = ['cmf:read', 'cmf:write', 'cmf:generate'] as const;
export type McpScope = typeof MCP_SCOPES[number];
export interface McpConfig { resource: string; issuer: string; webOrigin: string }

export function getMcpConfig(): McpConfig {
  const resource = new URL(process.env.MCP_PUBLIC_URL || 'http://localhost:3001/mcp');
  const web = new URL(process.env.MCP_WEB_ORIGIN || 'http://localhost:3000');
  for (const url of [resource, web]) {
    if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new Error('MCP URLs must use HTTPS (loopback HTTP is allowed only outside production)');
    }
  }
  if (resource.pathname !== '/mcp' || web.pathname !== '/') {
    throw new Error('MCP_PUBLIC_URL must end in /mcp; MCP_WEB_ORIGIN must be an origin');
  }
  return { resource: resource.href, issuer: resource.origin, webOrigin: web.origin };
}

export function parseScopes(value: string | undefined): McpScope[] {
  const scopes = [...new Set((value || 'cmf:read').split(' ').filter(Boolean))];
  if (!scopes.length || scopes.some(scope => !MCP_SCOPES.includes(scope as McpScope))) {
    throw new Error('invalid_scope');
  }
  return scopes as McpScope[];
}

export const redirectUriSchema = z.string().max(2048).url().refine(value => {
  const url = new URL(value);
  return !url.username && !url.password && !url.hash &&
    (url.protocol === 'https:' || (url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
}, 'Redirect URI must use HTTPS or a loopback HTTP address');
