import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch all leads (can add filters from query params)
        // Ideally should be scoped to team
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                fullName: true,
                email: true,
                company: true,
                status: true,
                value: true,
                wonAt: true,
                createdAt: true,
                campaign: {
                    select: { name: true }
                }
            }
        });

        const csvData = leads.map(l => ({
            Name: l.fullName,
            Email: l.email,
            Company: l.company,
            Status: l.status,
            "Deal Value": l.value || 0,
            "Won Date": l.wonAt ? l.wonAt.toISOString() : "",
            Campaign: l.campaign?.name || "N/A",
            Created: l.createdAt.toISOString()
        }));

        const csvString = Papa.unparse(csvData);

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="analytics_export_${Date.now()}.csv"`
            }
        });

    } catch (error: any) {
        console.error("Error exporting analytics:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
