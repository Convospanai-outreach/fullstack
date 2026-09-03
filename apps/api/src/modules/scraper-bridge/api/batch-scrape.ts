import { NextResponse } from "next/server";
import { scraperService } from "../service/scraperService";

import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { audit } from "@/lib/governance/audit";

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { requests } = body;

        if (!Array.isArray(requests)) {
            return NextResponse.json(
                { ok: false, error: "requests must be an array" },
                { status: 400 }
            );
        }

        // Same governance check as the single-request sibling (scrape.ts) -
        // batch requests bypassed per-team scraping quotas entirely without this.
        try {
            await enforcePolicy({ orgId: teamId, userId, action: "SCRAPING", payload: body });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        const results = await scraperService.batchScrape(requests);

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "SCRAPING_RUN",
            entity: "Scraper",
            entityId: "batch",
            metadata: { count: requests.length },
        });

        return NextResponse.json({ ok: true, results });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
