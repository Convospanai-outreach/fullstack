import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import Papa from "papaparse";
import { streamingCsvResponse } from "@/lib/csvStream";

const EXPORT_BATCH_SIZE = 1000;

const COLUMNS = ["Name", "Email", "Company", "Status", "Deal Value", "Won Date", "Campaign", "Created"] as const;

export async function GET(_req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Stream in id-stable batches (cursor pagination) so the full lead set is
        // never materialized at once. Order matches the previous export (newest
        // first) with id as the stable cursor tiebreaker.
        async function* chunks() {
            let cursorId: string | undefined;
            for (;;) {
                const batch = await prisma.lead.findMany({
                    where: { teamId },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    take: EXPORT_BATCH_SIZE,
                    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        company: true,
                        status: true,
                        value: true,
                        wonAt: true,
                        createdAt: true,
                        campaign: { select: { name: true } },
                    },
                });
                if (batch.length === 0) break;

                const rows = batch.map((l) => ({
                    Name: l.fullName,
                    Email: l.email,
                    Company: l.company,
                    Status: l.status,
                    "Deal Value": l.value || 0,
                    "Won Date": l.wonAt ? l.wonAt.toISOString() : "",
                    Campaign: l.campaign?.name || "N/A",
                    Created: l.createdAt.toISOString(),
                }));
                // header:false - the column header is emitted once by the helper.
                yield Papa.unparse(rows, { header: false, columns: COLUMNS as unknown as string[], newline: "\n" });

                if (batch.length < EXPORT_BATCH_SIZE) break;
                cursorId = batch[batch.length - 1]!.id;
            }
        }

        return streamingCsvResponse({
            filename: `analytics_export_${Date.now()}.csv`,
            header: COLUMNS.join(","),
            logLabel: `analytics/export team=${teamId}`,
            chunks,
        });
    } catch (error: any) {
        console.error("Error exporting analytics:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
