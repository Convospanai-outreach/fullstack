import { NextResponse, type NextRequest } from "next/server";
import { getRobotsTxt } from "./app/robots";
import { createMarkdownResponse, getMarkdownForPath, isMarkdownRequested } from "./lib/markdownNegotiator";

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

    if (isMarkdownRequested(request)) {
        const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
        return createMarkdownResponse(getMarkdownForPath(pathname, siteUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
