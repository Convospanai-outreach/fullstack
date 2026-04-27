import { HardwareService } from "@/services/HardwareService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, payload, text, query, workflow, region, maskedId, purpose } = body;

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
            default:
                return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function GET() {
    try {
        const workflows = await HardwareService.getWorkflows();
        return new Response(JSON.stringify(workflows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
