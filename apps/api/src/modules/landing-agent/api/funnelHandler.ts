import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseFunnelRange, parseSourceDimension } from "../funnelReport";
import { getFunnelReport } from "../funnelReportService";

// GET /landing-agent/funnel?from=&to=&landingPageId=&variantId=&groupBy= (phase 12). Range defaults to the last 30 days, max 90.
export async function getFunnelReportHandler(req: Request) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(ctx.userId, ctx.teamId, TeamRole.MEMBER);

        const params = new URL(req.url).searchParams;
        const range = parseFunnelRange({ from: params.get("from") ?? undefined, to: params.get("to") ?? undefined }, new Date());
        if (!range.ok) {
            const message = range.reason === "range_too_long" ? "The report covers at most 90 days" : "Choose a valid date range";
            throw new APIError(message, 400, "VALIDATION_ERROR");
        }

        const sourceDimension = parseSourceDimension(params.get("groupBy"));
        if (!sourceDimension) throw new APIError("groupBy must be utm_source, utm_medium, utm_campaign or utm_content", 400, "VALIDATION_ERROR");

        return successResponse(
            await getFunnelReport({
                teamId: ctx.teamId,
                range: { from: range.from, to: range.to },
                landingPageId: params.get("landingPageId") || undefined,
                variantId: params.get("variantId") || undefined,
                sourceDimension,
            }),
        );
    } catch (error) {
        return handleAPIError(error);
    }
}
