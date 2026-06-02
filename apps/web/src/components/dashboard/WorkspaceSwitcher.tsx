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
        return <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl" />;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                            {activeTeam?.name?.charAt(0) || "T"}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-white line-clamp-1">{activeTeam?.name || "Select Team"}</p>
                            <p className="text-xs text-gray-400">Free Plan</p>
                        </div>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-gray-500" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800 text-white" align="start">
                <DropdownMenuLabel className="text-xs text-gray-500 uppercase tracking-widest">My Workspaces</DropdownMenuLabel>
                {teams.map((team) => (
                    <DropdownMenuItem
                        key={team.id}
                        onClick={() => switchTeam(team.id)}
                        className="flex items-center justify-between cursor-pointer focus:bg-white/10 focus:text-white"
                    >
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{team.name}</span>
                        </div>
                        {activeTeam?.id === team.id && <Check className="w-4 h-4 text-blue-500" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="cursor-pointer focus:bg-white/10 focus:text-white text-gray-400">
                    <div className="flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" />
                        <span>Create Workspace</span>
                    </div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
