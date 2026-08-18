import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getToken } from "next-auth/jwt";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

const INTERNAL_API_ORIGIN =
    process.env["API_INTERNAL_ORIGIN"] ||
    process.env["API_BASE_URL"] ||
    "http://localhost:3001";

const STRIPPED_UPSTREAM_RESPONSE_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
    "alt-svc",
]);

function sanitizeUpstreamResponseHeaders(upstreamHeaders: Headers) {
    const headers = new Headers();

    upstreamHeaders.forEach((value, key) => {
        if (STRIPPED_UPSTREAM_RESPONSE_HEADERS.has(key.toLowerCase())) {
            return;
        }
        headers.set(key, value);
    });

    return headers;
}


function getTargetUrl(req: NextRequest, pathParts: string[] | undefined): URL {
    if (!pathParts || pathParts.length === 0) {
        throw new Error("Proxy path is required");
    }

    if (!/^https?:\/\//.test(INTERNAL_API_ORIGIN)) {
        throw new Error("API_INTERNAL_ORIGIN must be an absolute URL");
    }

    const normalizedPath = pathParts.join("/");
    const target = new URL(`/${normalizedPath}${req.nextUrl.search}`, INTERNAL_API_ORIGIN);

    // Guard against accidental recursive proxy loops.
    if (target.origin === req.nextUrl.origin && target.pathname.startsWith("/api/proxy")) {
        throw new Error("Invalid proxy target: recursive proxy detected");
    }

    return target;
}

const WEB_OWNED_API_ROOTS = new Set([
    "approvals",
    "campaigns",
    "contact",
    "extension",
    "health",
    "help",
    "invitations",
    "invite-requests",
    "metrics",
    "register",
    "studio",
    "support",
    "webhooks",
]);

// `settings`, `admin`, `dashboard`, `upload`, `integrations`, `email`, and `leads` only
// have SOME of their paths implemented under apps/web/src/app/api/** - the rest are
// apps/api-only routes (settings/sso, admin/ai-config, dashboard/stats, upload/pdf,
// integrations/google/domain-checks, email/send, leads/bulk, etc). Whole-root matching
// like WEB_OWNED_API_ROOTS above would redirect those apps/api-only paths to a
// nonexistent apps/web route (a 404) instead of proxying them upstream, so these need
// path-level matching instead. `workflows` has zero apps/web routes at all (the whole
// builder lives in apps/api), so it's intentionally absent from both sets.
const LEADS_RESERVED_SEGMENTS = new Set(["bulk", "export", "import"]);

export function isWebOwnedPath(pathParts: string[]): boolean {
    const [root, second, third] = pathParts;

    if (root === "settings") {
        // Only apps/web/src/app/api/settings/{branding,hidden-features} exist; everything
        // else (sso, guardrails, crm, governance, audit, keys, webhooks, ...) is apps/api-only.
        return second === "branding" || second === "hidden-features";
    }

    if (root === "admin") {
        // Only apps/web/src/app/api/admin/{cms,invites,users} exist; everything else
        // (ai-config, audit, health, observability, rate-limits, usage, client-errors,
        // super, ...) is apps/api-only.
        return second === "cms" || second === "invites" || second === "users";
    }

    if (root === "dashboard") {
        // Only apps/web/src/app/api/dashboard/{funnel,summary} exist; everything else
        // (activities, analytics, briefing, campaigns, stats) is apps/api-only.
        return second === "funnel" || second === "summary";
    }

    if (root === "upload") {
        // Only apps/web/src/app/api/upload/csv exists; upload/pdf is apps/api-only.
        return second === "csv";
    }

    if (root === "integrations") {
        // apps/api has no routes at all under integrations/{fbl,microsoft,smtp} - those
        // are entirely web-owned. Under integrations/google, apps/api owns domain-checks,
        // mailboxes/sync, and pubsub; apps/web owns oauth/{start,callback} and the base
        // mailboxes endpoint.
        if (second === "fbl" || second === "microsoft" || second === "smtp") return true;
        if (second === "google") {
            if (third === "oauth") return true;
            if (third === "mailboxes") return pathParts.length === 3; // base only, not mailboxes/sync
            return false;
        }
        return false;
    }

    if (root === "email") {
        // Only the public, unauthenticated one-click unsubscribe link is web-owned;
        // send/compose/track/verify all live in apps/api.
        return second === "unsubscribe";
    }

    if (root === "leads") {
        if (pathParts.length === 1) return true; // GET/POST /leads (list, create)
        if (pathParts.length === 2) return !LEADS_RESERVED_SEGMENTS.has(second || ""); // /leads/[id], not /leads/bulk|export|import
        if (pathParts.length === 3) return third === "timeline"; // /leads/[id]/timeline
        return false; // /leads/[id]/{action,enrich,identity,journey,...} - apps/api-only
    }

    return false;
}

function getWebOwnedApiUrl(req: NextRequest, pathParts: string[]): URL | null {
    if (!pathParts || pathParts.length === 0) return null;
    const root = pathParts[0] || "";

    if (root === "auth") {
        const authPath = pathParts.slice(1).join("/");
        return new URL(`/api/auth/${authPath}${req.nextUrl.search}`, req.nextUrl.origin);
    }

    if (root === "orchestrator") {
        // orchestrator/swarm/* is handled by Fastify API upstream; only local orchestrator/run is web-owned
        if (pathParts[1] !== "swarm") {
            const apiPath = pathParts.join("/");
            return new URL(`/api/${apiPath}${req.nextUrl.search}`, req.nextUrl.origin);
        }
        return null;
    }

    if (WEB_OWNED_API_ROOTS.has(root) || isWebOwnedPath(pathParts)) {
        const apiPath = pathParts.join("/");
        return new URL(`/api/${apiPath}${req.nextUrl.search}`, req.nextUrl.origin);
    }

    return null;
}

async function addInternalAuthHeaders(req: NextRequest, headers: Headers) {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) return;

    const clerkUser = await findOrCreateClerkAppUser();
    if (clerkUser?.id) {
        const timestamp = String(Date.now());
        const email = clerkUser.email || "";
        const role = typeof clerkUser.enterpriseRole === "string" ? clerkUser.enterpriseRole : "";
        const payload = `v1.${timestamp}.${clerkUser.id}.${email}.${role}`;
        const signature = createHmac("sha256", secret).update(payload).digest("hex");

        headers.set("x-craftmyfunnel-user-id", clerkUser.id);
        headers.set("x-craftmyfunnel-user-email", email);
        headers.set("x-craftmyfunnel-user-role", role);
        headers.set("x-craftmyfunnel-auth-ts", timestamp);
        headers.set("x-craftmyfunnel-auth-signature", signature);
        return;
    }

    const token = await getToken({ req, secret });
    const userId = typeof token?.sub === "string"
        ? token.sub
        : typeof token?.["id"] === "string"
            ? token["id"]
            : "";

    if (!userId) return;

    const email = typeof token?.email === "string" ? token.email : "";
    const role = typeof token?.["enterpriseRole"] === "string" ? token["enterpriseRole"] : "";
    const timestamp = String(Date.now());
    const payload = `v1.${timestamp}.${userId}.${email}.${role}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    headers.set("x-craftmyfunnel-user-id", userId);
    headers.set("x-craftmyfunnel-user-email", email);
    headers.set("x-craftmyfunnel-user-role", role);
    headers.set("x-craftmyfunnel-auth-ts", timestamp);
    headers.set("x-craftmyfunnel-auth-signature", signature);
}

async function forwardRequest(req: NextRequest, pathParts: string[] | undefined) {
    try {
        if (!pathParts || pathParts.length === 0) {
            throw new Error("Proxy path is required");
        }

        const webOwnedTarget = getWebOwnedApiUrl(req, pathParts);
        const target = webOwnedTarget ?? getTargetUrl(req, pathParts);
        const headers = new Headers(req.headers);

        headers.delete("host");
        headers.delete("connection");
        headers.delete("content-length");

        if (!webOwnedTarget) {
            await addInternalAuthHeaders(req, headers);
        }

        const method = req.method.toUpperCase();
        const body =
            method === "GET" || method === "HEAD"
                ? null
                : await req.arrayBuffer();

        const requestInit: RequestInit = {
            method,
            headers,
            redirect: "manual",
        };

        if (body !== null) {
            requestInit.body = body;
        }

        const upstream = await fetch(target, requestInit);
        const responseHeaders = sanitizeUpstreamResponseHeaders(upstream.headers);

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Proxy failure";
        return NextResponse.json({
            error: message === "fetch failed" ? "Upstream API is unavailable or API_INTERNAL_ORIGIN is misconfigured." : message,
            code: "PROXY_UPSTREAM_UNAVAILABLE",
            upstream: INTERNAL_API_ORIGIN.replace(/\/\/.*@/, "//[redacted]@"),
        }, { status: 502 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}
