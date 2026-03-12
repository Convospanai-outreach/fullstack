import { NextResponse } from "next/server";
import { exportService } from "@/modules/data-export/service/exportService";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function GET(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") as "leads" | "campaigns";
        const format = searchParams.get("format") || "csv";

        if (!["leads", "campaigns"].includes(type)) {
            throw new APIError("Invalid export type", 400, "BAD_REQUEST");
        }

        let content = "";
        let contentType = "";
        let filename = `${type}-export-${new Date().toISOString().split('T')[0]}`;

        if (format === "json") {
            content = await exportService.generateJson(type, teamId);
            contentType = "application/json";
            filename += ".json";
        } else {
            content = await exportService.generateCsv(type, teamId);
            contentType = "text/csv";
            filename += ".csv";
        }

        return new NextResponse(content, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
