import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
    getAgentSkillsDiscoveryIndex,
    getAgentSkillsDiscoveryIndexJson,
    getAgentSkillContent,
    computeSha256Digest,
    SKILL_DEFINITIONS,
} from '../../src/lib/agentSkills';
import { GET as getSkillsIndexRoute } from '../../src/app/.well-known/agent-skills/index.json/route';
import { GET as getSkillMdRoute } from '../../src/app/.well-known/agent-skills/[skill]/SKILL.md/route';

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

describe('Agent Skills Discovery Index RFC v0.2.0 (/.well-known/agent-skills/index.json)', () => {
    describe('getAgentSkillsDiscoveryIndex', () => {
        it('includes the official $schema field for v0.2.0', () => {
            const index = getAgentSkillsDiscoveryIndex('https://craftmyfunnel.live');
            expect(index.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
        });

        it('includes skills array with name, type, description, url, and SHA-256 digest', () => {
            const index = getAgentSkillsDiscoveryIndex('https://craftmyfunnel.live');
            expect(Array.isArray(index.skills)).toBe(true);
            expect(index.skills.length).toBeGreaterThanOrEqual(1);

            index.skills.forEach((skill) => {
                // name format: lowercase alphanumeric + hyphens
                expect(skill.name).toMatch(/^[a-z0-9-]+$/);
                expect(skill.type).toBe('skill-md');
                expect(skill.description).toBeDefined();
                expect(typeof skill.description).toBe('string');
                expect(skill.description.length).toBeGreaterThan(10);
                expect(skill.url).toContain(`/.well-known/agent-skills/${skill.name}/SKILL.md`);

                // digest format: sha256:{hex}
                expect(skill.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
            });
        });

        it('verifies that each declared digest matches the SHA-256 of the actual SKILL.md artifact', () => {
            const index = getAgentSkillsDiscoveryIndex('https://craftmyfunnel.live');

            index.skills.forEach((skill) => {
                const content = getAgentSkillContent(skill.name);
                expect(content).not.toBeNull();

                const expectedHex = crypto.createHash('sha256').update(content!, 'utf8').digest('hex');
                expect(skill.digest).toBe(`sha256:${expectedHex}`);
            });
        });

        it('serializes to valid JSON via getAgentSkillsDiscoveryIndexJson', () => {
            const jsonStr = getAgentSkillsDiscoveryIndexJson('https://craftmyfunnel.live');
            const parsed = JSON.parse(jsonStr);

            expect(parsed.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
            expect(parsed.skills.length).toBe(Object.keys(SKILL_DEFINITIONS).length);
        });
    });

    describe('Route Handlers', () => {
        it('GET /.well-known/agent-skills/index.json returns HTTP 200 with application/json', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/.well-known/agent-skills/index.json');
            const res = await getSkillsIndexRoute(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/json');

            const body = await res.json();
            expect(body.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
            expect(body.skills.length).toBeGreaterThanOrEqual(1);
        });

        it('GET /.well-known/agent-skills/[skill]/SKILL.md returns HTTP 200 with text/markdown', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/.well-known/agent-skills/b2b-lead-intake/SKILL.md');
            const res = await getSkillMdRoute(req, {
                params: Promise.resolve({ skill: 'b2b-lead-intake' }),
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/markdown');

            const text = await res.text();
            expect(text).toContain('name: b2b-lead-intake');
            expect(text).toContain('# B2B Lead Intake');
        });

        it('GET /.well-known/agent-skills/[skill]/SKILL.md returns 404 for unknown skill', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/.well-known/agent-skills/non-existent/SKILL.md');
            const res = await getSkillMdRoute(req, {
                params: Promise.resolve({ skill: 'non-existent' }),
            });

            expect(res.status).toBe(404);
        });
    });
});
