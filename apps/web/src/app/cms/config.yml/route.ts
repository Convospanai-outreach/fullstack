import { buildDecapConfig, canonicalOrigin } from "@/lib/decapCms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    return new Response(buildDecapConfig(canonicalOrigin(req.url)), {
        headers: { "content-type": "text/yaml; charset=utf-8", "cache-control": "no-store" },
    });
}
