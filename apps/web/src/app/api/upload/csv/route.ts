import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

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

        if (contentType?.includes("application/json")) {
            const body = await req.json();
            csvText = body.csv || body.csvText || "";
            fieldMapping = body.fieldMapping;
            campaignId = body.campaignId;
        } else {
            csvText = await req.text();
        }

        if (!csvText || csvText.trim() === "") {
            return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
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
