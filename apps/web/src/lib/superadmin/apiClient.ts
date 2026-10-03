import { buildInternalAuthHeaders } from "@/lib/internalAuthHeaders";

const INTERNAL_API_ORIGIN =
    process.env["API_INTERNAL_ORIGIN"] ||
    process.env["API_BASE_URL"] ||
    "http://localhost:3001";

// Mirrors apps/web/src/app/api/proxy/[...path]/route.ts's addInternalAuthHeaders -
// apps/api's checkAdmin() (apps/api/src/lib/admin.ts) only understands a NextAuth
// session or this exact HMAC header scheme, and that gate is intentionally not
// being touched for the new standalone superadmin login.
function signInternalAdminHeaders(user: { id: string; email: string; enterpriseRole: string }, url: URL, method = "GET"): HeadersInit {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");

    return buildInternalAuthHeaders({
        secret,
        userId: user.id,
        email: user.email,
        role: user.enterpriseRole,
        method,
        path: url.pathname,
    });
}

export async function fetchSuperAdminOverview(
    user: { id: string; email: string; enterpriseRole: string },
    range: string
): Promise<{ status: number; body: unknown }> {
    const url = new URL("/admin/super/overview", INTERNAL_API_ORIGIN);
    url.searchParams.set("range", range);

    const res = await fetch(url, {
        headers: signInternalAdminHeaders(user, url),
        cache: "no-store",
    });
    const body = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return { status: res.status, body };
}

export async function fetchSuperAdminUserDetail(
    actor: { id: string; email: string; enterpriseRole: string },
    targetUserId: string,
    range: string
): Promise<{ status: number; body: unknown }> {
    const url = new URL(`/admin/super/users/${encodeURIComponent(targetUserId)}`, INTERNAL_API_ORIGIN);
    url.searchParams.set("range", range);

    const res = await fetch(url, {
        headers: signInternalAdminHeaders(actor, url),
        cache: "no-store",
    });
    const body = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return { status: res.status, body };
}

// Redis status / on-off switch (apps/api routes/admin/super/redis). POST only when
// `enabled` is given.
export async function superAdminRedis(
    actor: { id: string; email: string; enterpriseRole: string },
    enabled?: boolean
): Promise<{ status: number; body: unknown }> {
    const url = new URL("/admin/super/redis", INTERNAL_API_ORIGIN);
    const method = enabled === undefined ? "GET" : "POST";
    const res = await fetch(url, {
        method,
        headers: {
            ...signInternalAdminHeaders(actor, url, method),
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify({ enabled }) } : {}),
        cache: "no-store",
    });
    const body = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return { status: res.status, body };
}
