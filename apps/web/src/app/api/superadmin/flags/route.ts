import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";
import { superAdminApi } from "@/lib/superadmin/apiClient";

// Platform feature flags, defined and evaluated in apps/api (lib/flags/config.ts).
export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    try {
        const { status, body } = await superAdminApi(actor, "GET", "/admin/super/flags");
        return NextResponse.json(body, { status });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Upstream request failed" }, { status: 502 });
    }
}

export async function POST(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const input = (await req.json().catch(() => null)) as { key?: unknown; enabled?: unknown } | null;
    if (typeof input?.key !== "string" || (input.enabled !== null && typeof input.enabled !== "boolean")) {
        return NextResponse.json({ error: "key and enabled (true, false or null) are required" }, { status: 400 });
    }
    try {
        const { status, body } = await superAdminApi(actor, "POST", "/admin/super/flags", { key: input.key, enabled: input.enabled });
        if (status < 300) await auditSuperAdmin(actor, "FLAG_SET", req, { key: input.key, enabled: input.enabled });
        return NextResponse.json(body, { status });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Upstream request failed" }, { status: 502 });
    }
}
