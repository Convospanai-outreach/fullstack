import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getConfiguredEdgeRuntimeEndpoint } from "@/lib/edgeRuntime";

// Hardware fingerprint card and capability matrix for the Edge page.
// /health and /capabilities on the node need no key. The hardware id is shortened before it leaves the API.
async function getJson(url: string) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
        return res.ok ? ((await res.json()) as Record<string, any>) : null;
    } catch {
        return null;
    }
}

const shortenHardwareId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const endpoint = getConfiguredEdgeRuntimeEndpoint();
    if (!endpoint) return NextResponse.json({ success: true, data: { reachable: false } });

    const [health, caps] = await Promise.all([getJson(`${endpoint}/health`), getJson(`${endpoint}/capabilities`)]);
    const flags = caps?.capabilities && typeof caps.capabilities === "object" ? caps.capabilities : {};
    return NextResponse.json({
        success: true,
        data: {
            reachable: health !== null,
            hardwareId: typeof health?.hardware_id === "string" ? shortenHardwareId(health.hardware_id) : null,
            services: Array.isArray(health?.services) ? health.services : [],
            capabilities: {
                tokenize: flags.tokenize === true,
                classify: flags.classify === true,
                generate: flags.generate === true,
                execute: flags.execute === true,
            },
        },
    });
}
