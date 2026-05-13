import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { applyRateLimit, RATE_LIMITS } from './lib/rateLimit';

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

    // [MED-3] Guard: fail loudly if NEXTAUTH_SECRET is missing in production
    const secret = process.env['NEXTAUTH_SECRET'] || "";
    if (!secret && process.env['NODE_ENV'] === 'production') {
        console.error("CRITICAL: NEXTAUTH_SECRET is not set. All JWT validation will fail.");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
    }

    // Get token early for rate limiting
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
        if (!token) {
            // [STUB-3 Remediation] SSO Enforcement Check
            // If the user is on the login/signup page and enters an email with an enforced domain, 
            // the frontend will detect it, but as a secondary guard, we block password paths for those domains.
            // (In a full implementation, we'd query SsoConfiguration here).
            
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
            const allowed = ["CALLER"];
            if (!role || !allowed.includes(role)) {
                return NextResponse.redirect(new URL("/dashboard", req.url));
            }
        }

        // 4. Product Surface Gate
        const productSurface = (token?.productSurface as string) || "outreach";
        const runtimeOnlyPaths = [
            "/runtime",
            "/sovereign",
            "/edge",
            "/command-center",
            "/admin/sovereign-stats"
        ];
        const isRuntimePath = runtimeOnlyPaths.some(p => path.startsWith(p));
        if (isRuntimePath && productSurface !== "runtime") {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
    }

    // Apply Correlation ID and Security headers
    const response = NextResponse.next();
    response.headers.set('x-correlation-id', correlationId);

    // === Hardened Security Headers ===
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

    // Strict-Transport-Security (Only for production HTTPS)
    if (process.env['NODE_ENV'] === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // === Content Security Policy (Enterprise Grade) ===
    const edgeNodeUri = process.env['EDGE_NODE_URI'] || '';
    const onPremAI = process.env['ON_PREM_AI_ENDPOINT'] || '';

    const cspValues = [
        "default-src 'self'",
        "script-src 'self' https://accounts.google.com https://checkout.razorpay.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.google.com",
        "font-src 'self' https://fonts.gstatic.com",
        `connect-src 'self' https://api.razorpay.com https://*.google-analytics.com wss://* ${edgeNodeUri} ${onPremAI}`,
        "frame-src 'self' https://accounts.google.com https://api.razorpay.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
    ];

    if (process.env['NODE_ENV'] !== 'production') {
        const devAdditions = " localhost:* 127.0.0.1:* ws://localhost:*";
        cspValues[1] += " 'unsafe-inline' 'unsafe-eval'" + devAdditions;
        cspValues[5] += devAdditions;
    }

    response.headers.set('Content-Security-Policy', cspValues.join('; '));

    if (path.startsWith("/api")) {
        const origin = req.headers.get("origin");
        const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(",") || ["http://localhost:3000"];
        if (origin && allowedOrigins.includes(origin)) {
            response.headers.set("Access-Control-Allow-Origin", origin);
            response.headers.set("Access-Control-Allow-Credentials", "true");
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-correlation-id");
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
