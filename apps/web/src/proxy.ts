import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { applyRateLimit, RATE_LIMITS } from './lib/rateLimit.edge';
import {
    getDefaultEnabledHiddenFeatureKeys,
    getHiddenFeatureForPath,
    HIDDEN_FEATURES_COOKIE,
    isPathEnabled,
    mergeEnabledHiddenFeatureKeys,
    parseEnabledHiddenFeatureKeys,
    PRODUCT_FLAGS,
} from './lib/productFlags';

async function appProxy(req: NextRequest, clerkAuth?: any) {
    const path = req.nextUrl.pathname;
    const hiddenFeature = getHiddenFeatureForPath(path);
    const enabledHiddenFeatures = mergeEnabledHiddenFeatureKeys(
        getDefaultEnabledHiddenFeatureKeys(),
        parseEnabledHiddenFeatureKeys(req.cookies.get(HIDDEN_FEATURES_COOKIE)?.value)
    );
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const isDevelopment = process.env['NODE_ENV'] !== 'production';
    const authApiPrefixes = ["/api/auth", "/api/proxy/auth"];
    const webhookApiPrefixes = ["/api/webhooks", "/api/proxy/webhooks"];
    const clientErrorLogPrefixes = ["/api/errors/client", "/api/proxy/errors/client"];
    const adminApiPrefixes = ["/api/admin", "/api/proxy/admin"];
    const publicApiPrefixes = ["/api/health", "/api/test-auth", "/api/contact", "/api/help", "/api/support/contact", "/api/invite-requests", "/api/invitations/accept", "/api/webhooks/clerk", "/api/proxy/landing-agent/public", "/api/landing-agent/public"];
    const metricsApiPrefixes = ["/api/metrics", "/api/proxy/metrics"];
    const testDiagnosticPaths = ["/test-error-logging", "/test-crash"];
    let token: Record<string, unknown> | null = null;
    let userId: string | undefined;

    if (process.env['ENABLE_TEST_DIAGNOSTIC_ROUTES'] !== 'true' && testDiagnosticPaths.some((prefix) => path.startsWith(prefix))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (metricsApiPrefixes.some((prefix) => path.startsWith(prefix))) {
        const metricsToken = process.env['METRICS_TOKEN'];
        const authorization = req.headers.get("authorization");
        if (metricsToken && authorization !== `Bearer ${metricsToken}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!metricsToken && process.env['NODE_ENV'] === 'production') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    if (PRODUCT_FLAGS.betaMode && !isPathEnabled(path, enabledHiddenFeatures)) {
        if (path.startsWith("/api")) {
            return NextResponse.json({
                error: "This feature is disabled for the email-first beta.",
                feature: hiddenFeature?.key ?? null,
            }, { status: 404 });
        }

        const url = req.nextUrl.clone();
        url.pathname = "/settings/features";
        if (hiddenFeature) {
            url.searchParams.set("feature", hiddenFeature.key);
        }
        return NextResponse.redirect(url);
    }

    let clerkUserId: string | undefined;
    let clerkClaims: Record<string, unknown> | undefined;
    if (clerkAuth) {
        try {
            const authState = await clerkAuth();
            clerkUserId = authState?.userId || undefined;
            clerkClaims = authState?.sessionClaims as Record<string, unknown> | undefined;
        } catch {
            clerkUserId = undefined;
        }
    }

    const { getToken } = await import("next-auth/jwt");
    const secret = process.env['NEXTAUTH_SECRET'] || "";
    token = (await getToken({ req, secret })) as Record<string, unknown> | null;
    userId = clerkUserId || (typeof token?.['sub'] === "string" ? token['sub'] : undefined);

    // === RATE LIMITING (Before all other checks) ===
    if (path.startsWith("/api")) {
        let rateLimitResponse: NextResponse | null = null;
        
        // 1. Authentication endpoints (strictest)
        if (authApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTH, 'auth', userId);
        }
        // 2. Webhook endpoints
        else if (webhookApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WEBHOOK, 'webhook', userId);
        }
        // 3. Error logging endpoint
        else if (clientErrorLogPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ERROR_LOGGING, 'error-logging', userId);
        }
        // 4. Admin endpoints (high limit, but tracked)
        else if (adminApiPrefixes.some((prefix) => path.startsWith(prefix))) {
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
    const publicPaths = [
        "/",
        "/login",
        "/agent-login",
        "/client-login",
        "/signup",
        "/accept-invite",
        "/forgot-password",
        "/magic-link",
        "/verify-email",
        "/favicon.ico",
        "/favicon.svg",
        "/craftmyfunnel-logo.png",
        "/about",
        "/contact",
        "/pricing",
        "/p",
        "/faq",
        "/terms",
        "/privacy",
        "/help",
        "/security",
        "/support",
        "/data-deletion",
        "/google-api-disclosure",
        "/funnel",
    ];

    if (path === "/accept-invite" && !req.nextUrl.searchParams.get("token")) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("invite", "required");
        return NextResponse.redirect(url);
    }

    const cleanPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
    const isPublic = publicPaths.some(p => cleanPath === p || cleanPath.startsWith(p + "/")) ||
        path.startsWith("/p/") ||
        authApiPrefixes.some((prefix) => cleanPath.startsWith(prefix)) ||
        cleanPath.startsWith("/_next") ||
        cleanPath.startsWith("/static") ||
        cleanPath.startsWith("/images") ||
        webhookApiPrefixes.some((prefix) => cleanPath.startsWith(prefix)) ||
        publicApiPrefixes.some((prefix) => cleanPath.startsWith(prefix));

    if (!isPublic) {
        // Token already fetched at the top for rate limiting


        if (!token && !clerkUserId) {
            // Redirect if page, JSON error if API
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const url = req.nextUrl.clone();
            url.pathname = path.startsWith("/client") ? "/client-login" : "/login";
            url.searchParams.set("callbackUrl", path);
            return NextResponse.redirect(url);
        }

        // 3. Caller Page Protection (RBAC)
        const role = (token?.['enterpriseRole'] || clerkClaims?.['enterpriseRole']) as string;
        const superAdminRoles = ["SUPER_ADMIN", "SYSTEM_ADMIN"];
        const canManageUsers = superAdminRoles.includes(role) || role === "ORG_ADMIN";
        const canAccessCMS = canManageUsers || role === "CMS_EDITOR";

        if (
            role === "CMS_EDITOR" &&
            !path.startsWith("/admin/content") &&
            !path.startsWith("/admin/cms") &&
            !path.startsWith("/api/admin/cms") &&
            !path.startsWith("/api/auth")
        ) {
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/admin/content", req.url));
        }

        if (
            !clerkUserId &&
            (path.startsWith("/admin/users") || path.startsWith("/admin/invites") || path.startsWith("/api/admin/users") || path.startsWith("/api/admin/invites")) &&
            !canManageUsers
        ) {
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        if (
            (path.startsWith("/admin/content") || path.startsWith("/admin/cms") || path.startsWith("/api/admin/cms")) &&
            !canAccessCMS
        ) {
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        if (role === "CALLER" && !path.startsWith("/caller") && !path.startsWith("/api/auth") && !path.startsWith("/api/proxy/caller")) {
            if (path.startsWith("/api")) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/caller", req.url));
        }

        if (path.startsWith("/caller")) {
            // Strict RBAC: Caller UI is for Callers only. Managers use Dashboard.
            const allowed = ["CALLER"];

            if (!role || !allowed.includes(role)) {
                return NextResponse.redirect(new URL("/dashboard", req.url));
            }
        }

        // 4. Product Surface Gate
        const productSurface = (token?.['productSurface'] as string) || "outreach";
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
    const clerkFrontendApi = process.env['NEXT_PUBLIC_CLERK_FRONTEND_API'] || 'clerk.craftmyfunnel.live';
    const clerkFrontendHost = clerkFrontendApi.startsWith('http')
        ? clerkFrontendApi
        : `https://${clerkFrontendApi}`;
    
    const cspValues = [
        "default-src 'self'",
        // Scripts: Allow self, Clerk, Google Auth, and Razorpay
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${clerkFrontendHost} https://*.clerk.accounts.dev https://accounts.google.com https://checkout.razorpay.com`,
        // Styles: Allow self and Google Fonts
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Images: Allow self, Clerk avatars, Google placeholders, and data URLs for icons
        `img-src 'self' data: blob: ${clerkFrontendHost} https://*.clerk.accounts.dev https://img.clerk.com https://lh3.googleusercontent.com https://*.google.com`,
        // Fonts: Allow self and Google Fonts
        "font-src 'self' https://fonts.gstatic.com",
        // Connect: Self, Clerk, Analytics, Razorpay, plus Sovereign AI nodes & WebSockets
        `connect-src 'self' ${clerkFrontendHost} https://*.clerk.accounts.dev https://api.clerk.com https://api.razorpay.com https://*.google-analytics.com wss://* ${edgeNodeUri} ${onPremAI}`,
        // Frames: Clerk, Google Auth & Razorpay
        `frame-src 'self' ${clerkFrontendHost} https://*.clerk.accounts.dev https://accounts.google.com https://api.razorpay.com`,
        // Media/Workers: Stricter constraints
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ];

    if (process.env['NODE_ENV'] === 'production') {
        cspValues.push("upgrade-insecure-requests");
    }

    if (process.env['NODE_ENV'] !== 'production') {
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
        '/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)',
    ],
};

const clerkProxy = clerkMiddleware(async (auth, req) => appProxy(req as NextRequest, auth));

export default clerkProxy;
export const proxy = clerkProxy;
