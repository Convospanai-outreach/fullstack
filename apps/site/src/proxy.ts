import { NextResponse, type NextRequest } from "next/server";
import { getRobotsTxt } from "./app/robots";
import { getBlogPostBySlug } from "./lib/blog";
import { createMarkdownResponse, isMarkdownRequested } from "./lib/markdownNegotiator";

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/robots.txt") {
        return new NextResponse(getRobotsTxt(), {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    // Only negotiate single blog slugs backed by the same content as their HTML page.
    const slug = pathname.match(/^\/blog\/([a-z0-9-]+)$/)?.[1];
    if (slug && (request.method === "GET" || request.method === "HEAD")) {
        if (isMarkdownRequested(request.headers.get("accept") ?? "")) {
            const post = getBlogPostBySlug(slug);
            if (post) return createMarkdownResponse(`# ${post.title}\n\n${post.content}`, request.method);
        }
        return NextResponse.next({ headers: { Vary: "Accept" } });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
