import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(req: NextRequest) {
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

        // 3. Plan Enforcement (Optional - uncomment if needed)
        // const userPlan = (token.plan as string) || "FREE";
        // const requiredPlan: Record<string, string> = {
        //     "/api/agents": "PRO",
        //     "/dashboard/premium": "PRO",
        //     "/api/team": "ENTERPRISE",
        //     "/dashboard/team": "ENTERPRISE",
        // };

        // for (const [prefix, plan] of Object.entries(requiredPlan)) {
        //     if (path.startsWith(prefix) && userPlan !== plan && userPlan !== "ENTERPRISE") {
        //         if (path.startsWith("/api")) {
        //             return NextResponse.json({
        //                 error: `Upgrade to ${plan} required`,
        //                 code: "PLAN_REQUIRED",
        //                 requiredPlan: plan
        //             }, { status: 403 });
        //         } else {
        //             const url = new URL("/pricing", req.url);
        //             url.searchParams.set("upgrade_required", "true");
        //             return NextResponse.redirect(url);
        //         }
        //     }
        // }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
