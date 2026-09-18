import { createHmac } from "crypto";

const INTERNAL_API_ORIGIN =
    process.env["API_INTERNAL_ORIGIN"] ||
    process.env["API_BASE_URL"] ||
    "http://localhost:3001";

// Mirrors apps/web/src/app/api/proxy/[...path]/route.ts's addInternalAuthHeaders -
// apps/api's checkAdmin() (apps/api/src/lib/admin.ts) only understands a NextAuth
// session or this exact HMAC header scheme, and that gate is intentionally not
// being touched for the new standalone superadmin login.
function signInternalAdminHeaders(user: { id: string; email: string; enterpriseRole: string }): HeadersInit {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");

    const timestamp = String(Date.now());
    const payload = `v1.${timestamp}.${user.id}.${user.email}.${user.enterpriseRole}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    return {
        "x-craftmyfunnel-user-id": user.id,
        "x-craftmyfunnel-user-email": user.email,
        "x-craftmyfunnel-user-role": user.enterpriseRole,
        "x-craftmyfunnel-auth-ts": timestamp,
        "x-craftmyfunnel-auth-signature": signature,
    };
}

export async function fetchSuperAdminOverview(
    user: { id: string; email: string; enterpriseRole: string },
    range: string
): Promise<{ status: number; body: unknown }> {
    const url = new URL("/admin/super/overview", INTERNAL_API_ORIGIN);
    url.searchParams.set("range", range);

    const res = await fetch(url, {
        headers: signInternalAdminHeaders(user),
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
        headers: signInternalAdminHeaders(actor),
        cache: "no-store",
    });
    const body = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return { status: res.status, body };
}
