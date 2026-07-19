import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
    // Auth pages
    "/login(.*)",
    "/signup(.*)",
    "/verify-email(.*)",
    "/forgot-password(.*)",
    "/magic-link(.*)",
    "/accept-invite(.*)",
    "/agent-login(.*)",
    "/client-login(.*)",
    "/login/sso(.*)",

    // Marketing / public pages
    "/",
    "/pricing(.*)",
    "/about(.*)",
    "/contact(.*)",
    "/privacy(.*)",
    "/terms(.*)",
    "/security(.*)",
    "/faq(.*)",
    "/help(.*)",
    "/support(.*)",
    "/jobs(.*)",
    "/google-api-disclosure(.*)",
    "/data-deletion(.*)",

    // Public landing pages
    "/p/(.*)",

    // Next-Auth internal routes (Clerk handles separately but don't block these)
    "/api/auth(.*)",

    // Webhooks & public API callbacks (must not require auth)
    "/api/webhooks(.*)",
    "/api/proxy/integrations/google/oauth/callback(.*)",
    "/api/proxy/integrations/google/pubsub(.*)",

    // Health / metrics (internal scraping)
    "/api/health(.*)",
    "/api/metrics(.*)",
    "/api/readiness(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Run on all routes except Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
