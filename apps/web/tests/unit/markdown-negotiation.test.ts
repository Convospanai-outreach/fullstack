import { describe, expect, it } from 'vitest';
import {
    isMarkdownRequested,
    getMarkdownForPath,
    estimateMarkdownTokens,
    createMarkdownResponse,
} from '../../src/lib/markdownNegotiator';

function createMockRequest(url: string, headers: Record<string, string> = {}) {
    const parsed = new URL(url);
    const headerMap = new Headers(headers);
    return {
        headers: headerMap,
        nextUrl: {
            pathname: parsed.pathname,
            origin: parsed.origin,
        },
    };
}

describe('Markdown for Agents — Content Negotiation (Accept: text/markdown)', () => {
    describe('isMarkdownRequested', () => {
        it('detects text/markdown in Accept header for pages', () => {
            const req = createMockRequest('https://craftmyfunnel.live/pricing', {
                accept: 'text/markdown, text/html;q=0.9',
            });
            expect(isMarkdownRequested(req)).toBe(true);
        });

        it('ignores standard browser HTML requests', () => {
            const req = createMockRequest('https://craftmyfunnel.live/pricing', {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            });
            expect(isMarkdownRequested(req)).toBe(false);
        });

        it('ignores API routes even if text/markdown is accepted', () => {
            const req = createMockRequest('https://craftmyfunnel.live/api/leads', {
                accept: 'text/markdown',
            });
            expect(isMarkdownRequested(req)).toBe(false);
        });

        it('ignores static assets (images, stylesheets, scripts)', () => {
            const imageReq = createMockRequest('https://craftmyfunnel.live/images/logo.png', {
                accept: 'text/markdown',
            });
            expect(isMarkdownRequested(imageReq)).toBe(false);

            const nextAssetReq = createMockRequest('https://craftmyfunnel.live/_next/static/chunks/main.js', {
                accept: 'text/markdown',
            });
            expect(isMarkdownRequested(nextAssetReq)).toBe(false);
        });
    });

    describe('getMarkdownForPath', () => {
        it('returns structured markdown for homepage (/)', () => {
            const md = getMarkdownForPath('/');
            expect(md).toContain('# CraftMyFunnel — Governed B2B Outbound Sales Engine');
            expect(md).toContain('Human-in-the-Loop Governance');
            expect(md).toContain('/llms-full.txt');
        });

        it('returns structured pricing markdown for /pricing', () => {
            const md = getMarkdownForPath('/pricing');
            expect(md).toContain('# CraftMyFunnel — Pricing & Commercial Models');
            expect(md).toContain('Pilot ($49');
            expect(md).toContain('Growth Autopilot ($99');
            expect(md).toContain('Enterprise ($499');
        });

        it('returns FAQ markdown for /faq', () => {
            const md = getMarkdownForPath('/faq');
            expect(md).toContain('# CraftMyFunnel — Frequently Asked Questions (FAQ)');
            expect(md).toContain('Google Workspace');
        });

        it('returns Integrations markdown for /integrations', () => {
            const md = getMarkdownForPath('/integrations');
            expect(md).toContain('# CraftMyFunnel — Integrations & Protocol Directory');
            expect(md).toContain('HubSpot CRM');
            expect(md).toContain('Salesforce');
        });

        it('returns Glossary markdown for /glossary', () => {
            const md = getMarkdownForPath('/glossary');
            expect(md).toContain('# CraftMyFunnel — Technical & Outbound Glossary');
            expect(md).toContain('Generative Engine Optimization (GEO)');
            expect(md).toContain('RFC 5322');
            expect(md).toContain('RFC 8058');
        });

        it('returns Case Studies markdown for /case-studies', () => {
            const md = getMarkdownForPath('/case-studies');
            expect(md).toContain('# CraftMyFunnel — Enterprise Outbound Case Studies');
            expect(md).toContain('Commercial Facility Management');
        });

        it('handles dynamic routes (/locations/[city], /use-cases/[vertical], /blog/[slug])', () => {
            const locMd = getMarkdownForPath('/locations/bengaluru');
            expect(locMd).toContain('Bengaluru');

            const useCaseMd = getMarkdownForPath('/use-cases/facility-management');
            expect(useCaseMd).toContain('Facility Management');

            const blogMd = getMarkdownForPath('/blog/ai-search-optimization-ago');
            expect(blogMd).toContain('Ai Search Optimization Ago');
        });
    });

    describe('createMarkdownResponse & estimateMarkdownTokens', () => {
        it('calculates reasonable token estimation', () => {
            const text = 'Hello world! This is a test of the markdown token counter.';
            const tokens = estimateMarkdownTokens(text);
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBe(Math.ceil(text.length / 4));
        });

        it('returns 200 OK with correct Content-Type, Vary, and x-markdown-tokens headers', () => {
            const md = '# Sample Markdown Document\n\nTesting agent readiness response.';
            const res = createMarkdownResponse(md);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
            expect(res.headers.get('vary')).toBe('Accept');
            expect(res.headers.get('x-markdown-tokens')).toBeDefined();
            expect(parseInt(res.headers.get('x-markdown-tokens') || '0', 10)).toBeGreaterThan(0);
        });
    });
});
