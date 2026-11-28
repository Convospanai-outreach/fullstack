import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { getBlogPostBySlug } from '../../src/lib/blog';
import { proxy } from '../../src/proxy';

const slug = 'the-future-of-crm-why-ai-agents-will-replace-traditional-workflows';
const postPath = '/blog/' + slug;

function request(path: string, accept = 'text/markdown', method = 'GET') {
    return proxy(new NextRequest('https://craftmyfunnel.live' + path, {
        method,
        headers: { accept },
    }));
}

describe('Marketing Markdown negotiation', () => {
    it.each(['/', '/pricing', '/docs/mcp', '/integrations', '/case-studies', '/glossary',
        '/blog', '/blog/nonexistent-post', '/blog/a/b', '/api/leads'])(
        'keeps normal routing for %s when no Markdown source exists', (path) => {
            expect(request(path).headers.get('x-middleware-next')).toBe('1');
        },
    );

    it('returns the complete published blog article and its real title', async () => {
        const post = getBlogPostBySlug(slug)!;
        const response = request(postPath);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
        expect(response.headers.get('vary')).toContain('Accept');
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(await response.text()).toBe('# ' + post.title + '\n\n' + post.content);
    });

    it.each(['text/html', 'text/markdown;q=0, text/html', 'text/html, text/markdown;q=0.5',
        'text/markdown-preview'])('keeps HTML when Accept is %s', (accept) => {
        const response = request(postPath, accept);
        expect(response.headers.get('x-middleware-next')).toBe('1');
        expect(response.headers.get('vary')).toContain('Accept');
    });

    it('supports HEAD without a body, but does not intercept POST', async () => {
        const head = request(postPath, 'text/markdown, text/html;q=0.9', 'HEAD');
        expect(head.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
        expect(await head.text()).toBe('');
        expect(request(postPath, 'text/markdown', 'POST').headers.get('x-middleware-next')).toBe('1');
    });
});
