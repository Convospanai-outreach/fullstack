import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: "desc" }
        });

        // CSV Header
        const header = "ID,Full Name,Company,Job Title,Location,Email,LinkedIn,Status,Created At\n";

        // CSV Rows
        const rows = leads.map(lead => {
            const clean = (text: string | null) => text ? `"${text.replace(/"/g, '""')}"` : "";
            return [
                clean(lead.id),
                clean(lead.fullName),
                clean(lead.company),
                clean(lead.jobTitle),
                clean(lead.location),
                clean(lead.email),
                clean(lead.linkedIn),
                clean(lead.status),
                clean(lead.createdAt.toISOString())
            ].join(",");
        }).join("\n");

        const csv = header + rows;

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
