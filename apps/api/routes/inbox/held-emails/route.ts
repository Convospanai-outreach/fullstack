import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { listHeldEmails } from "@/modules/email-campaigner/service/heldEmails";

// Emails waiting because a merge field such as {{firstName}} is empty for the contact, with what is missing and
// what could be used instead.
export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);
        return NextResponse.json({ items: await listHeldEmails(teamId) });
    } catch (error) {
        return handleAPIError(error);
    }
}
