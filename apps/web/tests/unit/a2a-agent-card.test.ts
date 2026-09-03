import { describe, expect, it } from 'vitest';
import { getA2AAgentCard, getA2AAgentCardJson } from '../../src/lib/a2aAgentCard';
import { GET as getA2AAgentCardRoute } from '../../src/app/.well-known/agent-card.json/route';

function createMockRequest(url: string) {
    const parsed = new URL(url);
    return {
        headers: new Headers(),
        nextUrl: {
            pathname: parsed.pathname,
            origin: parsed.origin,
        },
    } as any;
}

describe('A2A Protocol Agent Card (/.well-known/agent-card.json)', () => {
    describe('getA2AAgentCard', () => {
        it('returns compliant Agent Card with name, version, and description', () => {
            const card = getA2AAgentCard('https://craftmyfunnel.live');

            expect(card.name).toBe('CraftMyFunnel Outbound Governance Agent');
            expect(card.version).toBe('1.0.0');
            expect(card.description).toBeDefined();
            expect(typeof card.description).toBe('string');
        });

        it('includes supportedInterfaces with service URLs and protocol bindings', () => {
            const card = getA2AAgentCard('https://craftmyfunnel.live');

            expect(card.supportedInterfaces).toBeDefined();
            expect(Array.isArray(card.supportedInterfaces)).toBe(true);
            expect(card.supportedInterfaces.length).toBeGreaterThanOrEqual(1);

            const httpInterface = card.supportedInterfaces[0];
            expect(httpInterface.url).toBe('https://craftmyfunnel.live/api/v1');
            expect(httpInterface.protocolBinding).toBe('HTTP+JSON');
            expect(httpInterface.protocolVersion).toBe('1.0');
        });

        it('lists capabilities and skills with id, name, and description', () => {
            const card = getA2AAgentCard('https://craftmyfunnel.live');

            expect(card.capabilities).toBeDefined();
            expect(typeof card.capabilities.streaming).toBe('boolean');
            expect(typeof card.capabilities.pushNotifications).toBe('boolean');

            expect(card.skills).toBeDefined();
            expect(Array.isArray(card.skills)).toBe(true);
            expect(card.skills.length).toBeGreaterThanOrEqual(1);

            card.skills.forEach((skill) => {
                expect(skill.id).toBeDefined();
                expect(typeof skill.id).toBe('string');
                expect(skill.name).toBeDefined();
                expect(typeof skill.name).toBe('string');
                expect(skill.description).toBeDefined();
                expect(typeof skill.description).toBe('string');
            });
        });

        it('serializes to valid JSON via getA2AAgentCardJson', () => {
            const jsonStr = getA2AAgentCardJson('https://craftmyfunnel.live');
            const parsed = JSON.parse(jsonStr);

            expect(parsed.name).toBe('CraftMyFunnel Outbound Governance Agent');
            expect(parsed.skills.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Route Handler', () => {
        it('GET /.well-known/agent-card.json returns HTTP 200 with application/json', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/.well-known/agent-card.json');
            const res = await getA2AAgentCardRoute(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/json');

            const body = await res.json();
            expect(body.name).toBe('CraftMyFunnel Outbound Governance Agent');
            expect(body.supportedInterfaces).toBeDefined();
            expect(body.skills).toBeDefined();
            expect(body.capabilities).toBeDefined();
        });
    });
});
