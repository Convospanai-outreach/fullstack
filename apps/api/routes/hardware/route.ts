import { HardwareService } from "@/services/HardwareService";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EdgeRuntimeError, requireEdgePiiAvailable } from "@/lib/edgeRuntime";

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
                await HardwareService.verifyHardwareIdentity();
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            case "SANITIZE":
                result = await HardwareService.sanitize(text);
                break;
            case "CRITIQUE":
                result = await HardwareService.critique(text, body.context);
                break;
            case "SEARCH":
                result = { results: await HardwareService.search(query) };
                break;
            case "EXECUTE":
                result = { success: await HardwareService.execute(payload?.actuator || "generic", payload || {}) };
                break;
            case "SAVE_WORKFLOW":
                await HardwareService.saveWorkflow(workflow);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            case "SET_COMPLIANCE":
                await HardwareService.setComplianceMode(region);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            case "RE_IDENTIFY":
                result = await HardwareService.reIdentify(maskedId, purpose);
                break;
            case "STATUS":
                result = await HardwareService.getStatus();
                break;
            case "ACTIVITY":
                result = { activity: await HardwareService.getActivity(body.limit) };
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

        const workflows = await HardwareService.getWorkflows();
        return new Response(JSON.stringify(workflows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
