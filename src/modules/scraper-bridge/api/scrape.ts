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

        // GOVERNANCE CHECK
        try {
            await enforcePolicy({ orgId: teamId, userId, action: "SCRAPING", payload: body });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        const result = await scraperService.scrape(body);

        // MANDATORY AUDIT LOG
        await audit({
            actorId: userId,
            orgId: teamId,
            action: "SCRAPING_RUN",
            entity: "Scraper",
            entityId: body.target,
            metadata: { url: body.url },
        });

        return NextResponse.json({ ok: true, result });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
