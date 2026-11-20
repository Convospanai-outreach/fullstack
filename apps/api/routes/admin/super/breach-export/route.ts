import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { getAdminUser } from "@/lib/admin";
import { neutralizeCsvFormula, streamingCsvResponse } from "@/lib/csvStream";

const EXPORT_BATCH_SIZE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDate(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Breach response: the leads one team held that were created in a time window, as a CSV the customer can use to
// tell the people affected. Super admin only. The AuditLog row is written first, so no export happens unrecorded.
// "Affected" is taken to mean created in the window; the person running the incident narrows or widens it.
export async function GET(req: Request) {
    try {
        const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
        if (!admin) throw new APIError("Forbidden: Super admin access required", 403, "FORBIDDEN");

        const params = new URL(req.url).searchParams;
        const teamId = params.get("teamId") ?? "";
        const from = parseDate(params.get("from"));
        const to = parseDate(params.get("to"));
        if (!UUID.test(teamId) || !from || !to || from > to) {
            throw new APIError("teamId, from and to are required, and from must not be after to", 400, "VALIDATION_ERROR");
        }

        const where = { teamId, createdAt: { gte: from, lte: to } };
        const count = await prisma.lead.count({ where });
        await prisma.auditLog.create({
            data: {
                orgId: teamId,
                actorId: admin.id,
                action: "BREACH_EXPORT",
                entity: "Lead",
                metadata: { from: from.toISOString(), to: to.toISOString(), count },
            },
        });

        const clean = (text: string | null) => (text ? `"${neutralizeCsvFormula(text).replace(/"/g, '""')}"` : "");

        async function* chunks() {
            let cursorId: string | undefined;
            for (;;) {
                const batch = await prisma.lead.findMany({
                    where,
                    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                    take: EXPORT_BATCH_SIZE,
                    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
                    select: { id: true, fullName: true, email: true, phone: true, company: true, source: true, createdAt: true },
                });
                if (batch.length === 0) break;

                yield batch
                    .map((lead) =>
                        [clean(lead.id), clean(lead.fullName), clean(lead.email), clean(lead.phone), clean(lead.company), clean(lead.source), clean(lead.createdAt.toISOString())].join(",")
                    )
                    .join("\n");

                if (batch.length < EXPORT_BATCH_SIZE) break;
                cursorId = batch[batch.length - 1]!.id;
            }
        }

        return streamingCsvResponse({
            filename: `breach-export-${teamId}-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`,
            header: "ID,Full Name,Email,Phone,Company,Source,Created At",
            logLabel: `breach-export team=${teamId}`,
            chunks,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
