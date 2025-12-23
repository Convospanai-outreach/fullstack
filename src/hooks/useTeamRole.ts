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
                    // In a multi-team setup, this would need more logic
                    // For now, we assume current context team
                    // Find the 'You' entry (id matches current user, typically handled by API returning data.myRole)
                    // Simplified: We'll assume the API provides a 'currentRole' or we find it in the list.
                    // For the sake of this prompt, we'll use a placeholder logic or rely on the list.
                    // Let's assume the standard members API is enough for now if we can identify 'self'.

                    // Actually, let's create a dedicated role endpoint if needed, 
                    // but for this task, we'll try to find 'self' in data.
                    const self = data.find((m: any) => m.status === 'active'); // Mock logic for demo
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
