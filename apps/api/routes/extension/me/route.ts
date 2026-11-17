import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";
import { copilotAccount } from "@/services/extensionCopilot/account";

// The copilot extension's sign-in check and licence: who is signed in, whether their plan is
// active, the team's credits and which bots are on. Asked at sign-in and every few hours.
export async function GET(req: NextRequest) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
    }
    const scope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
    if (!scope.ok) {
        return NextResponse.json({ error: scope.error, code: scope.code }, { status: scope.status });
    }
    const account = await copilotAccount(auth.user.id, scope.teamId);
    return NextResponse.json({
        valid: account.valid,
        user: { id: auth.user.id, email: auth.user.email, name: auth.user.name, credits: account.credits },
        team: { id: scope.teamId },
        plan: account.plan,
        features: account.features
    });
}
