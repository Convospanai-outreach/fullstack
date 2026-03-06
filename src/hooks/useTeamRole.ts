"use client";

import { useState, useEffect } from "react";

export enum TeamRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member",
    VIEWER = "viewer"
}

const ROLE_HIERARCHY = {
    [TeamRole.OWNER]: 4,
    [TeamRole.ADMIN]: 3,
    [TeamRole.MEMBER]: 2,
    [TeamRole.VIEWER]: 1
};

export function useTeamRole() {
    const [role, setRole] = useState<TeamRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRole = async () => {
            try {
                // We fetch the current user's membership from the team list 
                // Alternatively, we could have a dedicated /api/team/role endpoint
                const res = await fetch("/api/team/members");
                const { success, data } = await res.json();

                if (success) {
                    // Identify self by fetching the current session and matching email
                    const sessionRes = await fetch("/api/auth/session");
                    const session = await sessionRes.json();
                    const currentEmail = session?.user?.email;

                    const self = currentEmail
                        ? data.find((m: any) => m.email === currentEmail)
                        : data.find((m: any) => m.status === 'active');
                    setRole(self?.role as TeamRole || TeamRole.VIEWER);
                }
            } catch (e) {
                console.error("Failed to fetch role", e);
            } finally {
                setLoading(false);
            }
        };

        fetchRole();
    }, []);

    const hasPermission = (requiredRole: TeamRole) => {
        if (!role) return false;
        return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
    };

    return { role, loading, hasPermission, TeamRole };
}
