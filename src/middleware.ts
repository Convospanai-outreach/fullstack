import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// import { getToken } from 'next-auth/jwt';
// import { rateLimitService } from "@/modules/rate-limit/service/rateLimitService";
// import { Plan, isPlanEligible } from "@/lib/plans";

export async function middleware(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const path = req.nextUrl.pathname;

    // 1. CORS for API routes
    if (path.startsWith("/api")) {
        const origin = req.headers.get("origin");
        const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(",") || ["http://localhost:3000"];

        const response = NextResponse.next();

        // Only set CORS headers if origin is whitelisted
        if (origin && allowedOrigins.includes(origin)) {
            response.headers.set("Access-Control-Allow-Origin", origin);
            response.headers.set("Access-Control-Allow-Credentials", "true");
        }

        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            return new NextResponse(null, { status: 200, headers: response.headers });
        }
    }

    // 2. Authentication Check (Temporarily disabled for debugging Edge Runtime)
    // const publicPaths = ["/", "/login", "/signup", "/help", "/favicon.ico"];
    // const isPublic = publicPaths.some(p => path === p) ||
    //     path.startsWith("/api/auth") ||
    //     path.startsWith("/_next") ||
    //     path.startsWith("/static") ||
    //     path.startsWith("/api/webhooks");

    // if (!isPublic) {
    //     const secret = process.env['NEXTAUTH_SECRET'] || "";
    //     const token = await getToken({ req, secret });

    //     if (!token) {
    //         // Redirect if page, JSON error if API
    //         if (path.startsWith("/api")) {
    //             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    //         }
    //         const url = req.nextUrl.clone();
    //         url.pathname = "/login";
    //         url.searchParams.set("callbackUrl", path);
    //         return NextResponse.redirect(url);
    //     }

    //     // 3. Plan Enforcement
    //     const userPlan = (token.plan as string) || "FREE";
    //     const requiredPlan: Record<string, Plan> = {
    //         "/api/agents": Plan.PRO,
    //         "/dashboard/premium": Plan.PRO,
    //         "/api/team": Plan.ENTERPRISE,
    //         "/dashboard/team": Plan.ENTERPRISE,
    //         "/team": Plan.ENTERPRISE // Protect UI route shorthand
    //     };

    //     for (const [prefix, plan] of Object.entries(requiredPlan)) {
    //         if (path.startsWith(prefix)) {
    //             if (!isPlanEligible(userPlan, plan)) {
    //                 if (path.startsWith("/api")) {
    //                     return NextResponse.json({
    //                         error: `Upgrade to ${plan} required`,
    //                         code: "PLAN_REQUIRED",
    //                         requiredPlan: plan
    //                     }, { status: 403 });
    //                 } else {
    //                     const url = new URL("/pricing", req.url);
    //                     url.searchParams.set("upgrade_required", "true");
    //                     return NextResponse.redirect(url);
    //                 }
    //             }
    //         }
    //     }
    // }

    // 4. Rate Limiting (Temporarily disabled for Edge Runtime compatibility)
    // if (!path.startsWith("/_next") && !path.startsWith("/static")) {
    //     let limit = 100;
    //     let windowMs = 60 * 1000;

    //     const strictRoutes = ["/api/ai", "/api/agents", "/api/inbox/suggest", "/api/orchestrator", "/api/leads/import"];
    //     if (strictRoutes.some(route => path.startsWith(route))) {
    //         limit = 50;
    //     }

    //     // const { success, reset } = await rateLimitService.checkLimit(ip, limit, windowMs);

    //     // if (!success) {
    //     //     return new NextResponse("Too Many Requests", {
    //     //         status: 429,
    //     //         headers: {
    //     //             "X-RateLimit-Limit": limit.toString(),
    //     //             "X-RateLimit-Reset": reset.toString(),
    //     //             "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString()
    //     //         }
    //     //     });
    //     // }
    // }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
