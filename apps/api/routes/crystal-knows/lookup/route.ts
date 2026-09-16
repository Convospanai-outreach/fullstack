import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { CrystalService } from "@/modules/crystal-knows/service/crystalService";

// Submits (or resolves) a Crystal Knows profile lookup for the standalone
// search UI. Bounded server-side poll (see CrystalService.findOrCreateProfile) -
// jobs typically complete within tens of seconds, so this usually returns
// found/not_found directly; a "pending" response means the caller should
// retry the same body (same query -> same idempotency key) after a beat.
export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const query = {
        full_name: typeof body?.fullName === "string" ? body.fullName.trim() : undefined,
        name: typeof body?.fullName === "string" ? body.fullName.trim() : undefined,
        email: typeof body?.email === "string" ? body.email.trim() : undefined,
        linkedin_url: typeof body?.linkedinUrl === "string" ? body.linkedinUrl.trim() : undefined,
        job_title: typeof body?.jobTitle === "string" ? body.jobTitle.trim() : undefined,
        company_name: typeof body?.companyName === "string" ? body.companyName.trim() : undefined,
        phone: typeof body?.phone === "string" ? body.phone.trim() : undefined,
    };

    if (!query.full_name && !query.email && !query.linkedin_url && !query.phone) {
        return NextResponse.json({ error: "Provide at least a name, email, LinkedIn URL, or phone number." }, { status: 400 });
    }

    // Idempotency key derived from the query itself, so retrying the same
    // search (e.g. after a "pending" response) resubmits the same job
    // instead of creating a duplicate prediction.
    const recordId = `lookup:${[query.full_name, query.email, query.linkedin_url, query.phone].filter(Boolean).join("|")}`;

    const result = await CrystalService.findOrCreateProfile(teamId, query, { recordId });

    if (result.state === "not_configured") {
        return NextResponse.json({ error: "Connect a Crystal Knows API key in Settings before searching." }, { status: 422 });
    }
    if (result.state === "error") {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json(result);
}
