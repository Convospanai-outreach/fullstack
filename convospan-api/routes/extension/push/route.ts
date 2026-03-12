import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get("Authorization");
        if (!token) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, headline, about, location, url } = body;

        console.log("[Extension Push] Received profile:", name);

        // In a real app, verify token -> userId
        // For now, we'll just log and maybe create a Lead if it doesn't exist

        // Upsert Lead based on LinkedIn URL
        if (url) {
            const existingLead = await prisma.lead.findFirst({
                where: { linkedIn: url }
            });

            if (existingLead) {
                await prisma.lead.update({
                    where: { id: existingLead.id },
                    data: {
                        fullName: name,
                        jobTitle: headline,
                        location: location,
                        enrichedData: { ...(existingLead.enrichedData as object), about, source: "extension_scrape" }
                    }
                });
            } else {
                await prisma.lead.create({
                    data: {
                        fullName: name || "Unknown",
                        linkedIn: url,
                        jobTitle: headline,
                        location: location,
                        status: "NEW",
                        enrichedData: { about, source: "extension_scrape" }
                    }
                });
            }
        }

        return NextResponse.json({ ok: true, message: "Profile saved" });
    } catch (error: any) {
        console.error("[Extension Push] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
