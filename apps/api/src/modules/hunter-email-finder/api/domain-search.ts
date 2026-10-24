import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { hunterClient } from "../service/hunterClient";
import { internalErrorMessage } from "@/lib/internalError";

const MAX_DOMAIN_SEARCH_LIMIT = 25;

export async function GET(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const domain = searchParams.get("domain");
        const requested = parseInt(searchParams.get("limit") || "10", 10);
        const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_DOMAIN_SEARCH_LIMIT) : 10;

        if (!domain) {
            return NextResponse.json(
                { ok: false, error: "domain parameter is required" },
                { status: 400 }
            );
        }

        const result = await hunterClient.domainSearch(domain, limit);
        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: internalErrorMessage(err) },
            { status: 500 }
        );
    }
}
