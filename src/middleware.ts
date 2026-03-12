import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { applyRateLimit, RATE_LIMITS } from './lib/rateLimit';

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    // Get token early for rate limiting
    const secret = process.env['NEXTAUTH_SECRET'] || "";
    const token = await getToken({ req, secret });
    const userId = token?.sub as string | undefined;

    // === RATE LIMITING (Before all other checks) ===
    if (path.startsWith("/api")) {
        let rateLimitResponse: NextResponse | null = null;
        
        // 1. Authentication endpoints (strictest)
        if (path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/auth") || path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/register")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTH, 'auth', userId);
        }
        // 2. Webhook endpoints
        else if (path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/webhooks")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WEBHOOK, 'webhook', userId);
        }
        // 3. Error logging endpoint
        else if (path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/errors/client")) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ERROR_LOGGING, 'error-logging', userId);
        }
        // 4. Admin endpoints (high limit, but tracked)
        else if (path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/admin")) {
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
        path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/auth") ||
        path.startsWith("/_next") ||
        path.startsWith("/static") ||
        path.startsWith("/images") ||
        path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/webhooks") ||
        path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/test-auth");

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
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // === Content Security Policy (Enterprise Grade) ===
    const edgeNodeUri = process.env['EDGE_NODE_URI'] || '';
    const onPremAI = process.env['ON_PREM_AI_ENDPOINT'] || '';
    
    const cspValues = [
        "default-src 'self'",
        // Scripts: Allow self, Google Auth, and Razorpay
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://checkout.razorpay.com",
        // Styles: Allow self and Google Fonts
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Images: Allow self, Google placeholders, and data URLs for icons
        "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.google.com",
        // Fonts: Allow self and Google Fonts
        "font-src 'self' https://fonts.gstatic.com",
        // Connect: Self, Analytics, Razorpay, plus Sovereign AI nodes & WebSockets
        `connect-src 'self' https://api.razorpay.com https://*.google-analytics.com wss://* ${edgeNodeUri} ${onPremAI}`,
        // Frames: Google Auth & Razorpay
        "frame-src 'self' https://accounts.google.com https://api.razorpay.com",
        // Media/Workers: Stricter constraints
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
    ];

    if (process.env.NODE_ENV !== 'production') {
        // Dev friendliness
        const devAdditions = " localhost:* 127.0.0.1:* ws://localhost:*";
        cspValues[1] += devAdditions; // script-src
        cspValues[5] += devAdditions; // connect-src
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
