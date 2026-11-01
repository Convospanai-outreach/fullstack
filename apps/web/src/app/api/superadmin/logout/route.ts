import { NextResponse } from "next/server";
import { SUPERADMIN_COOKIE_NAME } from "@/lib/superadmin/session";
import { serializeCookie } from "@/lib/superadmin/cookieHeader";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

export async function POST(req: Request) {
    // Recorded while the cookie still says who is leaving. Signing out must never fail because the
    // record could not be written, so a failure here is logged and the cookie is cleared regardless.
    try {
        const actor = await getSuperAdminActor();
        if (actor) await auditSuperAdmin(actor, "LOGOUT", req, {});
    } catch (error) {
        console.error("[Superadmin] Failed to record logout", error);
    }

    const response = NextResponse.json({ ok: true });
    response.headers.append("Set-Cookie", serializeCookie(SUPERADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 }));
    return response;
}
