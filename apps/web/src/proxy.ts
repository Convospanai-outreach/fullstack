import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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
import { getRobotsTxt } from './app/robots';
import {
    isMarkdownRequested,
    getMarkdownForPath,
    createMarkdownResponse,
} from './lib/markdownNegotiator';
import { getApiCatalogJson, DISCOVERY_LINK_HEADER } from './lib/apiCatalog';
import { getWebBotAuthDirectoryJson } from './lib/webBotAuth';
import { getA2AAgentCardJson } from './lib/a2aAgentCard';
import {
    getAgentSkillsDiscoveryIndexJson,
    getAgentSkillContent,
} from './lib/agentSkills';

async function appProxy(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Health checks must stay outside auth/proxy/rate-limit work so they can
    // exercise the route boundary directly and remain safe no-I/O probes.
    if (path === "/api/health") {
        const healthHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
        } as const;

        const blocked = await applyRateLimit(req, RATE_LIMITS.PUBLIC, "public", undefined);
        if (blocked) {
            Object.entries(healthHeaders).forEach(([key, value]) => {
                blocked.headers.set(key, value);
            });
            return blocked;
        }

        const response = NextResponse.next();
        Object.entries(healthHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        return response;
    }

    if (path === "/robots.txt") {
        return new NextResponse(getRobotsTxt(), {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    if (isMarkdownRequested(req)) {
        const baseUrl = req.nextUrl.origin;
        const markdown = getMarkdownForPath(path, baseUrl);
        return createMarkdownResponse(markdown);
    }

    if (path === "/.well-known/api-catalog") {
        const origin = req.nextUrl.origin;
        if (req.method === "HEAD") {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    "Content-Type": "application/linkset+json; profile=\"https://www.rfc-editor.org/info/rfc9727\"",
                    "Link": "</.well-known/api-catalog>; rel=\"self\"; type=\"application/linkset+json\"",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
            });
        }
        return new NextResponse(getApiCatalogJson(origin), {
            status: 200,
            headers: {
                "Content-Type": "application/linkset+json; profile=\"https://www.rfc-editor.org/info/rfc9727\"",
                "Link": "</.well-known/api-catalog>; rel=\"self\"; type=\"application/linkset+json\"",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    if (path === "/.well-known/http-message-signatures-directory") {
        return new NextResponse(getWebBotAuthDirectoryJson(), {
            status: 200,
            headers: {
                "Content-Type": "application/http-message-signatures-directory+json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    if (path === "/.well-known/agent-card.json") {
        const origin = req.nextUrl.origin;
        return new NextResponse(getA2AAgentCardJson(origin), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    if (path === "/.well-known/agent-skills/index.json") {
        const origin = req.nextUrl.origin;
        return new NextResponse(getAgentSkillsDiscoveryIndexJson(origin), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
        });
    }

    if (path.startsWith("/.well-known/agent-skills/") && path.endsWith("/SKILL.md")) {
        const skillName = path.replace("/.well-known/agent-skills/", "").replace("/SKILL.md", "");
        const content = getAgentSkillContent(skillName);
        if (content) {
            return new NextResponse(content, {
                status: 200,
                headers: {
                    "Content-Type": "text/markdown; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
            });
        }
    }

    const hiddenFeature = getHiddenFeatureForPath(path);
    const enabledHiddenFeatures = mergeEnabledHiddenFeatureKeys(
        getDefaultEnabledHiddenFeatureKeys(),
        parseEnabledHiddenFeatureKeys(req.cookies.get(HIDDEN_FEATURES_COOKIE)?.value)
    );
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const isDevelopment = process.env['NODE_ENV'] !== 'production';
    const authApiPrefixes = ["/api/auth", "/api/proxy/auth"];
    // Read-only session checks, not sign-in attempts — see RATE_LIMITS.SESSION_CHECK.
    const sessionCheckApiPaths = ["/api/auth/session", "/api/auth/clerk-sync"];
    // NextAuth's own OAuth round-trip (csrf -> signin -> callback, at least 3
    // requests per sign-in) - see RATE_LIMITS.OAUTH_FLOW.
    const oauthFlowApiPrefixes = [
        "/api/auth/csrf",
        "/api/auth/providers",
        "/api/auth/signin",
        "/api/auth/callback",
        "/api/auth/signout",
        "/api/auth/error",
    ];
    const webhookApiPrefixes = ["/api/webhooks", "/api/proxy/webhooks"];
    // Extension routes enforce their own x-extension-key + Bearer check (validateExtensionAuth), not a Clerk cookie.
    const extensionApiPrefixes = ["/api/extension"];
    const clientErrorLogPrefixes = ["/api/errors/client", "/api/proxy/errors/client"];
    const adminApiPrefixes = ["/api/admin", "/api/proxy/admin"];
    const publicApiPrefixes = [
        "/api/health", "/api/test-auth", "/api/contact", "/api/help", "/api/support/contact",
        "/api/invite-requests", "/api/invitations/accept",
        "/api/proxy/landing-agent/public", "/api/landing-agent/public", "/api/email/unsubscribe",
        // Anonymous funnel-visitor checkout - see apps/api/server.ts's own publicPaths for the
        // same routes (they carry no CraftMyFunnel session by design; security boundary is the
        // Stripe/Razorpay state token, not a Clerk cookie).
        "/api/proxy/checkout", "/api/checkout",
        // Public pricing shown on /pricing before signup.
        "/api/proxy/billing/plans", "/api/billing/plans",
        "/api/openapi.json",
    ];
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

    const { getToken } = await import("next-auth/jwt");
    const secret = process.env['NEXTAUTH_SECRET'] || "";
    token = (await getToken({ req, secret })) as Record<string, unknown> | null;
    userId = typeof token?.['sub'] === "string" ? token['sub'] : undefined;

    // === RATE LIMITING (Before all other checks) ===
    if (path.startsWith("/api")) {
        let rateLimitResponse: NextResponse | null = null;
        
        // 1. Passive session-check endpoints (polled far more often than real sign-ins)
        if (sessionCheckApiPaths.some((p) => path === p || path.startsWith(`${p}/`))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.SESSION_CHECK, 'session-check', userId);
        }
        // 2. NextAuth's own OAuth round-trip endpoints - not brute-forceable
        // credential endpoints, so they don't belong in the strict AUTH bucket.
        else if (oauthFlowApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.OAUTH_FLOW, 'oauth-flow', userId);
        }
        // 3. Authentication endpoints (strictest)
        else if (authApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTH, 'auth', userId);
        }
        // 4. Webhook endpoints
        else if (webhookApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.WEBHOOK, 'webhook', userId);
        }
        // 5. Error logging endpoint
        else if (clientErrorLogPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ERROR_LOGGING, 'error-logging', userId);
        }
        // 6. Admin endpoints (high limit, but tracked)
        else if (adminApiPrefixes.some((prefix) => path.startsWith(prefix))) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.ADMIN, 'admin', userId);
        }
        // 7. Authenticated endpoints (requires valid token)
        else if (userId) {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.AUTHENTICATED, 'authenticated', userId);
        }
        // 8. Public endpoints (per IP)
        else {
            rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC, 'public', userId);
        }
        
        // If rate limit exceeded, return immediately
        if (rateLimitResponse) {
            return rateLimitResponse;
        }
    }


    // 1. CORS for API routes
    // Extension routes handle their own CORS/OPTIONS (chrome-extension:// origins) in their route handler.
    if (path.startsWith("/api") && !extensionApiPrefixes.some((prefix) => path.startsWith(prefix))) {
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
        "/manifest.webmanifest",
        "/about",
        "/blog",
        "/use-cases",
        "/vs",
        "/docs",
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
        "/sitemap.xml",
        "/robots.txt",
        "/llms.txt",
        "/llms-full.txt",
        "/.well-known",
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
        extensionApiPrefixes.some((prefix) => cleanPath.startsWith(prefix)) ||
        publicApiPrefixes.some((prefix) => cleanPath.startsWith(prefix));

    if (!isPublic) {
        // Token already fetched at the top for rate limiting


        if (!token) {
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
        const role = token?.['enterpriseRole'] as string;
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

    // NEXT_PUBLIC_API_URL is baked into client bundles and may point at a
    // cross-origin API host (e.g. during the Oracle VM migration) instead of
    // the same-origin /api/proxy path. When it's an absolute URL, its origin
    // must be allowlisted or the browser blocks every client-side API call.
    let publicApiOrigin = '';
    const publicApiUrl = process.env['NEXT_PUBLIC_API_URL'] || '';
    if (/^https?:\/\//.test(publicApiUrl)) {
        try {
            publicApiOrigin = new URL(publicApiUrl).origin;
        } catch {
            publicApiOrigin = '';
        }
    }

    const cspValues = [
        "default-src 'self'",
        // Scripts: Allow self, Google Auth, Razorpay, Cloudflare Turnstile, Google Tag
        // Manager/Analytics, and Cloudflare's own Web Analytics beacon (auto-injected by
        // the Cloudflare proxy in front of this site)
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://checkout.razorpay.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
        // Styles: Allow self and Google Fonts
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Images: Allow self, Google placeholders, and data URLs for icons
        "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.google.com",
        // Fonts: Allow self and Google Fonts
        "font-src 'self' https://fonts.gstatic.com",
        // Connect: Self, Analytics, Razorpay, plus Sovereign AI nodes & WebSockets
        `connect-src 'self' https://api.razorpay.com https://*.google-analytics.com https://www.googletagmanager.com https://cloudflareinsights.com wss://* ${edgeNodeUri} ${onPremAI} ${publicApiOrigin}`,
        // Frames: Google Auth, Razorpay & Cloudflare Turnstile
        "frame-src 'self' https://accounts.google.com https://api.razorpay.com https://challenges.cloudflare.com",
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

    if (path === "/" || path === "") {
        response.headers.set("Link", DISCOVERY_LINK_HEADER);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)',
    ],
};

export default appProxy;
export const proxy = appProxy;
