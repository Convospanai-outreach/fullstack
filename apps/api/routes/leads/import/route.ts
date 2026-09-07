import { NextResponse } from "next/server";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { csvImportLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        // Every sibling leads/* route requires at least MEMBER before mutating -
        // without this, a read-only VIEWER could bulk-create/overwrite leads via CSV import.
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const { isRateLimited } = csvImportLimiter.check(3, teamId);
        if (isRateLimited) {
            throw new APIError("Too many CSV imports. Please wait a minute before importing again.", 429, "RATE_LIMITED");
        }

        const contentType = req.headers.get("content-type") || "";

        let csvContent = "";
        let mapping: Record<string, string> | undefined = undefined;

        if (contentType.includes("application/json")) {
            const body = await req.json();
            csvContent = body.csvContent;
            mapping = body.mapping;
        } else {
            csvContent = await req.text();
        }

        if (!csvContent) throw new APIError("Empty file content", 400, "BAD_REQUEST");

        // Enforce session teamId strictly
        const result = await csvIngestionService.processCSV(csvContent, teamId, mapping);

        return NextResponse.json(result);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
