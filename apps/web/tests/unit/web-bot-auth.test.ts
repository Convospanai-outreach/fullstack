import { describe, expect, it } from 'vitest';
import {
    getWebBotAuthJwks,
    getWebBotAuthDirectoryJson,
    createWebBotAuthHeaders,
    WEB_BOT_AUTH_PUBLIC_KEY,
} from '../../src/lib/webBotAuth';
import { GET as getWebBotAuthDirectoryRoute } from '../../src/app/.well-known/http-message-signatures-directory/route';

describe('IETF Web Bot Auth (/.well-known/http-message-signatures-directory)', () => {
    describe('getWebBotAuthJwks', () => {
        it('returns a JWKS containing at least one Ed25519 public key', () => {
            const jwks = getWebBotAuthJwks();
            expect(jwks.keys).toBeDefined();
            expect(Array.isArray(jwks.keys)).toBe(true);
            expect(jwks.keys.length).toBeGreaterThanOrEqual(1);

            const primaryKey = jwks.keys[0];
            expect(primaryKey.kty).toBe('OKP');
            expect(primaryKey.crv).toBe('Ed25519');
            expect(primaryKey.x).toBeDefined();
            expect(typeof primaryKey.x).toBe('string');
            expect(primaryKey.kid).toBeDefined();
            expect(primaryKey.use).toBe('sig');
            expect(primaryKey.alg).toBe('EdDSA');
        });

        it('produces valid JSON string via getWebBotAuthDirectoryJson', () => {
            const jsonStr = getWebBotAuthDirectoryJson();
            const parsed = JSON.parse(jsonStr);
            expect(parsed.keys).toBeDefined();
            expect(parsed.keys[0].kty).toBe('OKP');
            expect(parsed.keys[0].x).toBe(WEB_BOT_AUTH_PUBLIC_KEY.x);
        });
    });

    describe('Route Handler', () => {
        it('GET /.well-known/http-message-signatures-directory returns HTTP 200 with application/http-message-signatures-directory+json', async () => {
            const res = await getWebBotAuthDirectoryRoute();

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/http-message-signatures-directory+json');

            const body = await res.json();
            expect(body.keys).toBeDefined();
            expect(body.keys.length).toBeGreaterThanOrEqual(1);
            expect(body.keys[0].crv).toBe('Ed25519');
        });
    });

    describe('createWebBotAuthHeaders', () => {
        it('generates compliant Signature-Agent, Signature-Input, and Signature headers', () => {
            const headers = createWebBotAuthHeaders({
                domain: 'craftmyfunnel.live',
                created: 1750000000,
                expires: 1750000300,
            });

            expect(headers['Signature-Agent']).toBe('https://craftmyfunnel.live/.well-known/http-message-signatures-directory');

            expect(headers['Signature-Input']).toContain('alg="ed25519"');
            expect(headers['Signature-Input']).toContain(`keyid="${WEB_BOT_AUTH_PUBLIC_KEY.kid}"`);
            expect(headers['Signature-Input']).toContain('tag="web-bot-auth"');
            expect(headers['Signature-Input']).toContain('created=1750000000');
            expect(headers['Signature-Input']).toContain('expires=1750000300');

            expect(headers.Signature).toBeDefined();
            expect(headers.Signature).toMatch(/^sig1=:[^:]+:$/);
        });
    });
});
