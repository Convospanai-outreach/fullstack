import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { streamingCsvResponse } from "@/lib/csvStream";

const EXPORT_BATCH_SIZE = 1000;

export async function GET() {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const clean = (text: string | null) => text ? `"${text.replace(/"/g, '""')}"` : "";

        // Stream in id-stable batches (cursor pagination) so the whole lead table
        // is never held in memory at once. Order matches the previous non-streamed
        // export (newest first), with id as the stable tiebreaker for the cursor.
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
                        company: true,
                        jobTitle: true,
                        location: true,
                        email: true,
                        linkedIn: true,
                        status: true,
                        createdAt: true,
                    },
                });
                if (batch.length === 0) break;

                yield batch.map((lead) => [
                    clean(lead.id),
                    clean(lead.fullName),
                    clean(lead.company),
                    clean(lead.jobTitle),
                    clean(lead.location),
                    clean(lead.email),
                    clean(lead.linkedIn),
                    clean(lead.status),
                    clean(lead.createdAt.toISOString()),
                ].join(",")).join("\n");

                if (batch.length < EXPORT_BATCH_SIZE) break;
                cursorId = batch[batch.length - 1]!.id;
            }
        }

        return streamingCsvResponse({
            filename: `leads-export-${new Date().toISOString().split("T")[0]}.csv`,
            header: "ID,Full Name,Company,Job Title,Location,Email,LinkedIn,Status,Created At",
            logLabel: `leads/export team=${teamId}`,
            chunks,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: error?.statusCode || 500 });
    }
}
