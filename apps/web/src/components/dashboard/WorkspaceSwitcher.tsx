"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, PlusCircle, Building2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

function formatTeamName(name?: string | null): string {
    if (!name) return "Select Team";
    return name.replace(/\bWorkspace\s+Workspace\b/gi, "Workspace").trim();
}

export function WorkspaceSwitcher() {
    const [teams, setTeams] = useState<any[]>([]);
    const [activeTeam, setActiveTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        fetchTeams(cancelled).finally(() => {
            if (!cancelled) {
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const fetchTeams = async (cancelled = false) => {
        try {
            const res = await fetch(getBrowserApiUrl("/user/teams"));
            if (!res.ok) {
                return;
            }
            const data = await res.json();

            if (!cancelled && data.teams) {
                setTeams(data.teams);

                // Get active from cookie or default
                const cookieValue = document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("convo-workspace-id="))
                    ?.split("=")[1];

                const active = data.teams.find((t: any) => t.id === cookieValue) || data.teams[0];
                setActiveTeam(active);
            }
        } catch {
            if (!cancelled) {
                setTeams([]);
                setActiveTeam(null);
            }
        }
    };

    const switchTeam = (teamId: string) => {
        // Set cookie
        document.cookie = `convo-workspace-id=${teamId}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.reload(); // Refresh to update server context
    };

    if (loading) {
        return <div className="h-12 w-full bg-muted animate-pulse rounded-xl" />;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between p-2 rounded-lg bg-muted hover:bg-accent transition-colors border border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-inner">
                            {activeTeam?.name?.charAt(0) || "T"}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-foreground line-clamp-1">{formatTeamName(activeTeam?.name)}</p>
                            <p className="text-xs text-muted-foreground">Free Plan</p>
                        </div>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-card border-border text-foreground" align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-widest">My Workspaces</DropdownMenuLabel>
                {teams.map((team) => (
                    <DropdownMenuItem
                        key={team.id}
                        onClick={() => switchTeam(team.id)}
                        className="flex items-center justify-between cursor-pointer focus:bg-accent focus:text-foreground"
                    >
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span>{formatTeamName(team.name)}</span>
                        </div>
                        {activeTeam?.id === team.id && <Check className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="cursor-pointer focus:bg-accent focus:text-foreground text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" />
                        <span>Create Workspace</span>
                    </div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
