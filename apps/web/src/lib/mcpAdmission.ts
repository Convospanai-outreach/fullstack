/** Verify the API's short-lived, grant-bound admission credential before selecting a rate bucket. */
export async function mcpAdmissionGrant(req: Request): Promise<string | null> {
  const secret = process.env['MCP_RELAY_SECRET'];
  const header = req.headers.get('x-cmf-mcp-admission');
  if (!secret || secret.length < 32 || secret === process.env['NEXTAUTH_SECRET'] || !header || req.method !== 'POST' || new URL(req.url).pathname !== '/api/mcp/execute') return null;
  const match = header.match(/^(\d{13})\.([A-Za-z0-9_-]{1,128})\.([a-f0-9]{64})$/);
  if (!match) return null;
  const [, timestamp, grantId, signature] = match;
  const age = Date.now() - Number(timestamp);
  if (age < -5000 || age > 30_000) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(signature!.match(/../g)!.map(part => Number.parseInt(part, 16)));
  const message = JSON.stringify(['mcp-admission-v1', Number(timestamp), grantId, 'POST', '/api/mcp/execute']);
  return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message)) ? grantId! : null;
}
