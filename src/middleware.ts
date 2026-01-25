import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

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
    const publicPaths = ["/", "/login", "/signup", "/help", "/favicon.ico", "/about", "/contact", "/pricing", "/terms", "/privacy", "/verify-email"];
    const isPublic = publicPaths.some(p => path === p) ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path.startsWith("/static") ||
        path.startsWith("/images") ||
        path.startsWith("/api/webhooks") ||
        path.startsWith("/api/queue") || // Public for Extension Polling
        path.startsWith("/api/test") || // Public for Verifying
        path.startsWith("/api/register");

    if (!isPublic) {
        const secret = process.env['NEXTAUTH_SECRET'] || "";
        const token = await getToken({ req, secret });

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
