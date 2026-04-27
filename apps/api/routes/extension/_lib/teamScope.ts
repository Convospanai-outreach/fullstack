export type TeamScopeResolution =
    | { ok: true; teamId: string }
    | { ok: false; status: number; code: string; error: string };

export function resolveExtensionTeamScope(
    teamIds: string[],
    requestedTeamId?: string | null
): TeamScopeResolution {
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
        return {
            ok: false,
            status: 403,
            code: "NO_TEAM_MEMBERSHIP",
            error: "User has no team membership"
        };
    }

    const requested = typeof requestedTeamId === "string" ? requestedTeamId.trim() : "";
    if (requested.length > 0) {
        if (!teamIds.includes(requested)) {
            return {
                ok: false,
                status: 403,
                code: "TEAM_ACCESS_DENIED",
                error: "Requested teamId is not accessible for this user"
            };
        }
        return { ok: true, teamId: requested };
    }

    if (teamIds.length > 1) {
        return {
            ok: false,
            status: 400,
            code: "TEAM_ID_REQUIRED",
            error: "teamId is required for multi-team users"
        };
    }

    return { ok: true, teamId: teamIds[0] };
}

