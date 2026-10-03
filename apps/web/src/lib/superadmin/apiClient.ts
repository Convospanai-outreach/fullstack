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

// Calls an apps/api admin route as the superadmin. `body` makes it a JSON request.
export async function superAdminApi(
    actor: { id: string; email: string; enterpriseRole: string },
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown
): Promise<{ status: number; body: unknown }> {
    const url = new URL(path, INTERNAL_API_ORIGIN);
    const res = await fetch(url, {
        method,
        headers: {
            ...signInternalAdminHeaders(actor, url, method),
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
    });
    const json = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return { status: res.status, body: json };
}
