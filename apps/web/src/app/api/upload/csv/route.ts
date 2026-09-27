import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

// Same ceiling as apps/api's CSV upload (MAX_CSV_UPLOAD_BYTES in
// modules/csv-ingestion/api/upload.ts) - roadmap 3.5 / S-14.
const MAX_CSV_UPLOAD_BYTES = 10 * 1024 * 1024;

// Returns null once the body exceeds the cap. Content-Length is only a hint (absent
// on chunked uploads, and a caller can lie), so bytes are also counted as they
// arrive and the stream is cancelled as soon as the cap is passed.
async function readCappedBody(req: NextRequest): Promise<string | null> {
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_CSV_UPLOAD_BYTES) return null;
    if (!req.body) return "";

    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_CSV_UPLOAD_BYTES) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
}

function autoDetectFieldMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    headers.forEach((h) => {
        const nh = h.toLowerCase().replace(/[\s_]+/g, "");
        if (nh.includes("email") || nh === "mail") mapping[h] = "email";
        else if (nh.includes("name") || nh === "fullname" || nh === "contactname") mapping[h] = "fullName";
        else if (nh.includes("linkedin") || nh.includes("profile")) mapping[h] = "linkedIn";
        else if (nh.includes("company") || nh === "org") mapping[h] = "company";
        else if (nh.includes("title") || nh.includes("role")) mapping[h] = "jobTitle";
        else if (nh.includes("location") || nh.includes("city")) mapping[h] = "location";
    });
    return mapping;
}

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prisma } = await import("@/lib/db");

        const contentType = req.headers.get("content-type");
        let csvText = "";
        let fieldMapping: any = undefined;
        let campaignId: string | undefined = undefined;

        const rawBody = await readCappedBody(req);
        if (rawBody === null) {
            return NextResponse.json(
                { error: `CSV upload is too large. Maximum size is ${MAX_CSV_UPLOAD_BYTES / (1024 * 1024)}MB.` },
                { status: 413 }
            );
        }

        if (contentType?.includes("application/json")) {
            const body = JSON.parse(rawBody);
            csvText = body.csv || body.csvText || "";
            fieldMapping = body.fieldMapping;
            campaignId = body.campaignId;
        } else {
            csvText = rawBody;
        }

        if (!csvText || csvText.trim() === "") {
            return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
        }

        // campaignId is caller-supplied - verify it actually belongs to this team
        // before linking any imported lead to it, or a caller could attach their
        // leads to (and pollute the stats of) another tenant's campaign, matching
        // the guard already applied in csvIngestionService.ts.
        if (campaignId) {
            const campaign = await prisma.campaign.findFirst({
                where: { id: campaignId, teamId },
                select: { id: true },
            });
            if (!campaign) {
                campaignId = undefined;
            }
        }

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
        });

        if (parsed.errors.length > 0 && parsed.data.length === 0) {
            return NextResponse.json({
                success: false,
                created: 0,
                skipped: 0,
                errors: parsed.errors.map((e) => ({ message: e.message })),
                totalParsed: 0,
            });
        }

        const headers = parsed.meta.fields || [];
        const activeMapping = fieldMapping || autoDetectFieldMapping(headers);

        const emailKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "email");
        const fullNameKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "fullName");
        const companyKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "company");
        const jobTitleKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "jobTitle");
        const linkedInKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "linkedIn");
        const locationKey = Object.keys(activeMapping).find((k) => activeMapping[k] === "location");

        let created = 0;
        let skipped = 0;
        const errors: Array<{ message: string }> = [];
        const rows = parsed.data as Array<Record<string, string>>;

        for (const row of rows) {
            try {
                const rawEmail = emailKey ? row[emailKey] : undefined;
                const email = rawEmail ? rawEmail.trim().toLowerCase() : undefined;

                if (!email || !email.includes("@")) {
                    skipped++;
                    continue;
                }

                const fullName = fullNameKey ? row[fullNameKey]?.trim() : undefined;
                const company = companyKey ? row[companyKey]?.trim() : undefined;
                const jobTitle = jobTitleKey ? row[jobTitleKey]?.trim() : undefined;
                const linkedIn = linkedInKey ? row[linkedInKey]?.trim() : undefined;
                const location = locationKey ? row[locationKey]?.trim() : undefined;

                const existing = await prisma.lead.findFirst({
                    where: {
                        email,
                        teamId,
                    },
                });

                if (existing) {
                    const updateData: any = {};
                    if (campaignId) updateData.campaignId = campaignId;
                    if (fullName) updateData.fullName = fullName;
                    if (company) updateData.company = company;
                    if (jobTitle) updateData.jobTitle = jobTitle;
                    if (linkedIn) updateData.linkedIn = linkedIn;
                    if (location) updateData.location = location;

                    await prisma.lead.update({
                        where: { id: existing.id },
                        data: updateData,
                    });
                    created++;
                } else {
                    const createData: any = {
                        email,
                        teamId,
                        status: "NEW",
                        pipelineState: "COLD",
                    };
                    if (campaignId) createData.campaignId = campaignId;
                    if (fullName) createData.fullName = fullName;
                    if (company) createData.company = company;
                    if (jobTitle) createData.jobTitle = jobTitle;
                    if (linkedIn) createData.linkedIn = linkedIn;
                    if (location) createData.location = location;

                    await prisma.lead.create({
                        data: createData,
                    });
                    created++;
                }
            } catch (e: any) {
                errors.push({ message: e.message || "Failed to process lead row" });
                skipped++;
            }
        }

        // Sync campaign targetCount if campaignId is provided
        if (campaignId && created > 0) {
            try {
                const totalLeadsInCampaign = await prisma.lead.count({ where: { campaignId } });
                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: { targetCount: totalLeadsInCampaign },
                });
            } catch (e: any) {
                console.warn("[UploadCSV] Failed updating campaign targetCount:", e);
            }
        }

        return NextResponse.json({
            success: true,
            created,
            skipped,
            totalParsed: rows.length,
            errors,
        });
    } catch (error: any) {
        console.error("POST /api/upload/csv error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
