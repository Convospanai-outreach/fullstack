import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";
import { superAdminApi } from "@/lib/superadmin/apiClient";

export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    try {
        const { status, body } = await superAdminApi(actor, "GET", "/admin/super/redis");
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

// The session cookie is SameSite=Strict, so a cross-site form can't reach this.
export async function POST(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const input = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
    if (typeof input?.enabled !== "boolean") {
        return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
    }

    try {
        const { status, body } = await superAdminApi(actor, "POST", "/admin/super/redis", { enabled: input.enabled });
        if (status < 300) {
            await auditSuperAdmin(actor, input.enabled ? "REDIS_ENABLE" : "REDIS_DISABLE", req, {
                result: (body as { state?: string }).state ?? null,
            });
        }
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
