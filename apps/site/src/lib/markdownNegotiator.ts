import { NextResponse } from 'next/server';

export function isMarkdownRequested(accept: string): boolean {
    let markdown = 0;
    let html = 0;
    for (const range of accept.toLowerCase().split(',')) {
        const [type, ...parameters] = range.trim().split(';').map(part => part.trim());
        const weight = parameters.find(part => part.startsWith('q='));
        const quality = weight ? Number(weight.slice(2)) : 1;
        if (!(quality > 0 && quality <= 1)) continue;
        if (type === 'text/markdown') markdown = Math.max(markdown, quality);
        if (type === 'text/html') html = Math.max(html, quality);
    }
    return markdown > 0 && markdown >= html;
}

export function createMarkdownResponse(markdown: string, method: string): NextResponse {
    return new NextResponse(method === 'HEAD' ? null : markdown, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Vary': 'Accept',
            'Cache-Control': 'private, no-store',
            'X-Markdown-Tokens': String(Math.ceil(markdown.length / 4)),
        },
    });
}
