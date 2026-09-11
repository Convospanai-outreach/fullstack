import { HardwareService } from "@/services/HardwareService";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EdgeRuntimeError, requireEdgePiiAvailable } from "@/lib/edgeRuntime";
import { getAdminUser } from "@/lib/admin";
import { UserRole } from "@prisma/client";

const PII_EDGE_ACTIONS = new Set(["SANITIZE", "RE_IDENTIFY", "CRITIQUE", "SEARCH", "EXECUTE"]);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, payload, text, query, workflow, region, maskedId, purpose } = body;

        // Every action requires a real session - only PII_EDGE_ACTIONS additionally need
        // a paired, online edge node for that team. This used to only gate the PII
        // actions, leaving SET_COMPLIANCE/STATUS/ACTIVITY/VERIFY/SAVE_WORKFLOW reachable
        // with no authentication at all.
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        if (PII_EDGE_ACTIONS.has(action)) {
            await requireEdgePiiAvailable(ctx.teamId, prisma);
        }

        let result;
        switch (action) {
            case "VERIFY":
                await HardwareService.verifyHardwareIdentity(ctx.teamId);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            case "SANITIZE":
                result = await HardwareService.sanitize(text, ctx.teamId);
                break;
            case "CRITIQUE":
                result = await HardwareService.critique(text, body.context, ctx.teamId);
                break;
            case "SEARCH":
                result = { results: await HardwareService.search(query, ctx.teamId) };
                break;
            case "EXECUTE": {
                // Restricted to a genuine platform operator, since this drives a physical
                // actuator. targetTeamId (admin-supplied, never trusted from a non-admin
                // caller) routes to that team's own paired edge node; omitted, it falls
                // back to the single global EDGE_NODE_URI, matching pre-multi-tenant
                // behavior for deployments with only one shared device.
                const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
                if (!admin) {
                    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }
                result = { success: await HardwareService.execute(payload?.actuator || "generic", payload || {}, body.targetTeamId) };
                break;
            }
            case "SAVE_WORKFLOW":
                // The edge node stores workflows keyed by the caller-supplied teamId on
                // the workflow body, not by session - without this check any team could
                // overwrite/inject a workflow tagged with another team's id.
                if (!workflow || workflow.teamId !== ctx.teamId) {
                    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }
                await HardwareService.saveWorkflow(workflow, ctx.teamId);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            case "SET_COMPLIANCE": {
                // Restricted to a genuine platform operator. targetTeamId (admin-supplied)
                // routes to that team's own paired edge node; omitted, it falls back to
                // the single global EDGE_NODE_URI, matching pre-multi-tenant behavior.
                const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
                if (!admin) {
                    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }
                await HardwareService.setComplianceMode(region, body.targetTeamId);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            case "RE_IDENTIFY": {
                // The edge vault's /v1/reidentify has no team scoping of its own - the
                // token IS the entire authorization surface. Without this check, any
                // team with PII-edge access could de-mask another team's PII by
                // supplying a maskedId they obtained through any secondary channel.
                // Mirrors leads/[id]/identity/route.ts's ownership check, but by token
                // value since this route only receives the token, not a record id.
                const ownsToken = await HardwareService.tokenBelongsToTeam(maskedId, ctx.teamId, prisma);
                if (!ownsToken) {
                    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }
                result = await HardwareService.reIdentify(maskedId, purpose, ctx.teamId);
                break;
            }
            case "STATUS":
                result = await HardwareService.getStatus(ctx.teamId);
                break;
            case "ACTIVITY":
                result = { activity: await HardwareService.getActivity(body.limit, ctx.teamId) };
                break;
            default:
                return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        if (e instanceof EdgeRuntimeError) {
            return new Response(JSON.stringify({ error: e.code, message: e.message }), { status: e.statusCode, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function GET() {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        // getWorkflows() now routes to the caller's own paired edge node when one
        // exists (falling back to the shared global endpoint otherwise); keep the
        // filter as defense-in-depth in case the global fallback is shared.
        const workflows = await HardwareService.getWorkflows(ctx.teamId);
        const ownWorkflows = (workflows || []).filter((w: any) => w?.teamId === ctx.teamId);
        return new Response(JSON.stringify(ownWorkflows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
