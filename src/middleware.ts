import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { applyRateLimit, RATE_LIMITS } from './lib/rateLimit';

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    // Get token early for rate limiting
    const secret = process.env['NEXTAUTH_SECRET'] || "";
    const token = await getToken({ req, secret });
    const userId = token?.sub as string | undefined;

    // === RATE LIMITING (Before all other checks) ===
    if (path.startsWith("/api")) {
        let rateLimitResponse: NextResponse | null = null;
        
        // 1. Authentication endpoints (strictest)
        if (path.startsWith("/api/auth") || path.startsWith("/api/register")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTH, 'auth', userId);
        }
        // 2. Webhook endpoints
        else if (path.startsWith("/api/webhooks")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WEBHOOK, 'webhook', userId);
        }
        // 3. Error logging endpoint
        else if (path.startsWith("/api/errors/client")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ERROR_LOGGING, 'error-logging', userId);
        }
        // 4. Admin endpoints (high limit, but tracked)
        else if (path.startsWith("/api/admin")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ADMIN, 'admin', userId);
        }
        // 5. Authenticated endpoints (requires valid token)
        else if (userId) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTHENTICATED, 'authenticated', userId);
        }
        // 6. Public endpoints (per IP)
        else {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC, 'public', userId);
        }
        
        // If rate limit exceeded, return immediately
        if (rateLimitResponse) {
            return rateLimitResponse;
        }
    }


    // 1. CORS for API routes
    if (path.startsWith("/api")) {
        const origin = req.headers.get("origin");
        const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(",") || ["http://localhost:3000"];

        // Preflight OPTIONS check
        if (req.method === "OPTIONS") {
            const response = new NextResponse(null, { status: 200 });
            if (origin && allowedOrigins.includes(origin)) {
                response.headers.set("Access-Control-Allow-Origin", origin);
                response.headers.set("Access-Control-Allow-Credentials", "true");
            }
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
            return response;
        }
    }

    // 2. Authentication Check
    const publicPaths = ["/", "/login", "/signup", "/favicon.ico", "/about", "/contact", "/pricing", "/terms", "/privacy", "/verify-email"];
    const isPublic = publicPaths.some(p => path === p) ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path.startsWith("/static") ||
        path.startsWith("/images") ||
        path.startsWith("/api/webhooks") ||
        path.startsWith("/api/test-auth");

    if (!isPublic) {
        // Token already fetched at the top for rate limiting


        if (!token) {
            // Redirect if page, JSON error if API
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const url = req.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("callbackUrl", path);
            return NextResponse.redirect(url);
        }

        // 3. Caller Page Protection (RBAC)
        if (path.startsWith("/caller")) {
            const role = token?.enterpriseRole as string;
            // Strict RBAC: Caller UI is for Callers only. Managers use Dashboard.
            const allowed = ["CALLER"];

            if (!role || !allowed.includes(role)) {
                return NextResponse.redirect(new URL("/dashboard", req.url));
            }
        }
    }

    // Apply CORS headers to the actual response for API routes
    const response = NextResponse.next();
    if (path.startsWith("/api")) {
        const origin = req.headers.get("origin");
        const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(",") || ["http://localhost:3000"];
        if (origin && allowedOrigins.includes(origin)) {
            response.headers.set("Access-Control-Allow-Origin", origin);
            response.headers.set("Access-Control-Allow-Credentials", "true");
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
