import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { rateLimitService } from "@/modules/rate-limit/service/rateLimitService";
import { Plan, isPlanEligible } from "@/lib/plans";

export async function proxy(request: NextRequest) {
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

    // 3. Plan Enforcement
    if (!isPublic) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

        if (!token) {
            // Unauthenticated user trying to access protected route
            const url = request.nextUrl.clone();
            url.pathname = "/login"; // Redirect to login, not api/auth/signin
            url.searchParams.set("callbackUrl", path);
            return NextResponse.redirect(url);
        }

        // Check Plan
        const userPlan = (token.plan as string) || "FREE";

        // Define protected paths
        const requiredPlan: Record<string, Plan> = {
            "/api/agents": Plan.PRO,
            "/dashboard/premium": Plan.PRO,
            "/api/team": Plan.ENTERPRISE,
            "/dashboard/team": Plan.ENTERPRISE
        };

        for (const [prefix, plan] of Object.entries(requiredPlan)) {
            if (path.startsWith(prefix)) {
                if (!isPlanEligible(userPlan, plan)) {
                    if (path.startsWith("/api")) {
                        return NextResponse.json({
                            error: `Upgrade to ${plan} required`,
                            code: "PLAN_REQUIRED",
                            requiredPlan: plan
                        }, { status: 403 });
                    } else {
                        // For pages, redirect to pricing with a helpful message (via query param if needed)
                        const url = new URL("/pricing", request.url);
                        url.searchParams.set("upgrade_required", "true");
                        return NextResponse.redirect(url);
                    }
                }
            }
        }
    }

    // 4. Rate Limiting (Skip for static assets)
    if (!path.startsWith("/_next") && !path.startsWith("/static")) {
        // ... existing rate limit logic ...
        // Dynamic limits based on path
        let limit = 100;
        let windowMs = 60 * 1000;

        const strictRoutes = ["/api/ai", "/api/agents", "/api/inbox/suggest", "/api/orchestrator", "/api/leads/import"];
        if (strictRoutes.some(route => path.startsWith(route))) {
            limit = 50; // Stricter for AI and orchestrator
        }

        const { success, reset } = rateLimitService.checkLimit(ip, limit, windowMs);

        if (!success) {
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Reset": reset.toString(),
                    "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString()
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
