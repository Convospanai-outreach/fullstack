import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { mcpAdmissionGrant } from './mcpAdmission';

const key = 'independent-admission-secret-over-32-characters';
function request(grant = 'grant-1', timestamp = Date.now(), method = 'POST', path = '/api/mcp/execute') {
  const signature = createHmac('sha256', key).update(JSON.stringify(['mcp-admission-v1', timestamp, grant, method, path])).digest('hex');
  return new Request(`https://app.example${path}`, { method, headers: { 'x-cmf-mcp-admission': `${timestamp}.${grant}.${signature}` } });
}
beforeEach(() => { process.env['MCP_RELAY_SECRET'] = key; process.env['NEXTAUTH_SECRET'] = 'separate-login-key'; });
describe('MCP relay admission', () => {
  it('returns distinct verified grants for callers sharing an IP', async () => {
    expect(await mcpAdmissionGrant(request('grant-1'))).toBe('grant-1');
    expect(await mcpAdmissionGrant(request('grant-2'))).toBe('grant-2');
  });
  it('rejects forged, expired and differently scoped credentials', async () => {
    const forged = request(); forged.headers.set('x-cmf-mcp-admission', forged.headers.get('x-cmf-mcp-admission')!.replace('grant-1', 'grant-2'));
    expect(await mcpAdmissionGrant(forged)).toBeNull();
    expect(await mcpAdmissionGrant(request('grant-1', Date.now() - 31_000))).toBeNull();
    expect(await mcpAdmissionGrant(request('grant-1', Date.now() + 10_000))).toBeNull();
    expect(await mcpAdmissionGrant(request('grant-1', Date.now(), 'GET'))).toBeNull();
    expect(await mcpAdmissionGrant(request('grant-1', Date.now(), 'POST', '/api/other'))).toBeNull();
  });
});
