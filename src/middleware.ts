import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { rateLimitService } from "@/modules/rate-limit/service/rateLimitService";

export async function middleware(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const path = request.nextUrl.pathname;

    // 1. CORS for API routes
    if (path.startsWith("/api")) {
        const response = NextResponse.next();
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (request.method === "OPTIONS") {
            return new NextResponse(null, { status: 200, headers: response.headers });
        }
    }

    // 2. Authentication Check
    // Define public paths that don't need auth
    const publicPaths = ["/", "/login", "/signup", "/help", "/favicon.ico"];
    const isPublic = publicPaths.some(p => path === p) ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path.startsWith("/static") ||
        path.startsWith("/api/webhooks");

    // Check token if not public
    if (!isPublic) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
        if (!token) {
            const url = request.nextUrl.clone();
            url.pathname = "/api/auth/signin";
            url.searchParams.set("callbackUrl", path);
            return NextResponse.redirect(url);
        }
    }

    // 3. Rate Limiting (Skip for static assets)
    if (!path.startsWith("/_next") && !path.startsWith("/static")) {
        // Dynamic limits based on path
        let limit = 100;
        let windowMs = 60 * 1000;

        if (path.startsWith("/api/ai")) {
            limit = 50; // Stricter for AI
        }

        const { success, reset } = rateLimitService.checkLimit(ip, limit, windowMs);

        if (!success) {
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Reset": reset.toString(),
                    "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString()
                }
            });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
