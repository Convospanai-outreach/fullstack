import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

function planAllowsFullIntel(planName: string | null | undefined, features: any): boolean {
    const normalized = (planName || "FREE").toUpperCase();
    if (normalized === "ENTERPRISE") return true;
    if (normalized === "PRO") {
        return Boolean(features?.intel_full_payload || features?.intel_enrichment);
    }
    return false;
}

function resolveNetjanaBaseUrl() {
    const url = (process.env["NETJANA_URL"] || "").trim();
    return url.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const signalId = typeof body?.signalId === "string" ? body.signalId.trim() : "";
    if (!signalId) {
        return NextResponse.json({ ok: false, error: "signalId is required" }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });

    const planName = subscription?.plan?.name || null;
    const planFeatures = subscription?.plan?.features || {};

    if (!planAllowsFullIntel(planName, planFeatures)) {
        return NextResponse.json(
            {
                ok: false,
                error: "Full Intel reports are available on top-tier plans.",
                code: "UPGRADE_REQUIRED",
            },
            { status: 403 }
        );
    }

    const shadowSignal = await prisma.shadowSignal.findFirst({
        where: {
            id: signalId,
            teamId,
            source: "netjana-intel",
        },
        select: {
            id: true,
            metadata: true,
        },
    });

    if (!shadowSignal) {
        return NextResponse.json({ ok: false, error: "Signal not found" }, { status: 404 });
    }

    const metadata = (typeof shadowSignal.metadata === "object" && shadowSignal.metadata !== null)
        ? (shadowSignal.metadata as Record<string, any>)
        : {};

    const externalLeadId =
        (typeof metadata.externalLeadId === "string" && metadata.externalLeadId) ||
        (typeof metadata.lead_id === "string" && metadata.lead_id) ||
        "";

    if (!externalLeadId) {
        return NextResponse.json({ ok: false, error: "Signal is missing externalLeadId" }, { status: 409 });
    }

    const netjanaUrl = resolveNetjanaBaseUrl();
    if (!netjanaUrl) {
        return NextResponse.json({ ok: false, error: "NETJANA_URL not configured" }, { status: 501 });
    }

    const pullKey = (process.env["NETJANA_PULL_API_KEY"] || "").trim();
    if (!pullKey) {
        return NextResponse.json({ ok: false, error: "NETJANA_PULL_API_KEY not configured" }, { status: 501 });
    }

    try {
        // Expected NetJana endpoint (to be implemented in the NetJana app):
        // GET {NETJANA_URL}/v1/intel/leads/{lead_id}
        const upstream = await axios.get(`${netjanaUrl}/v1/intel/leads/${encodeURIComponent(externalLeadId)}`, {
            timeout: 6000,
            headers: {
                "x-api-key": pullKey,
                "x-source": "convospan",
            },
        });

        const data = upstream.data ?? {};
        const lead = data.lead ?? data;

        return NextResponse.json({
            ok: true,
            signalId: shadowSignal.id,
            lead: {
                lead_id: lead.lead_id ?? externalLeadId,
                company_name: lead.company_name ?? metadata.companyName ?? "",
                geo_state: lead.geo_state ?? null,
                sector: lead.sector ?? null,
                source_id: lead.source_id ?? null,
                procurement_category: lead.procurement_category ?? null,
                intent_score: lead.intent_score ?? metadata.intentScore ?? null,
                buying_stage: lead.buying_stage ?? metadata.buyingStage ?? null,
                verity_tier: lead.verity_tier ?? metadata.verityTier ?? null,
                is_triangulated: lead.is_triangulated ?? metadata.isTriangulated ?? null,
                card_why_now: lead.card_why_now ?? "",
                card_what_they_need: lead.card_what_they_need ?? "",
                card_do_this: lead.card_do_this ?? "",
                created_at: lead.created_at ?? null,
            },
        });
    } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || "NetJana pull failed";
        const status = Number(error?.response?.status) || 502;
        return NextResponse.json({ ok: false, error: message }, { status });
    }
}

