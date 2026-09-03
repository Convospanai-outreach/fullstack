"use client";

import { useState } from "react";
import { Briefcase, LayoutDashboard, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExecutiveView from "./personas/ExecutiveView";
import ManagerView from "./personas/ManagerView";
import OperatorView from "./personas/OperatorView";

type Persona = "executive" | "manager" | "operator";

const personaCopy: Record<Persona, { title: string; description: string; helper: string }> = {
    executive: {
        title: "Executive view",
        description: "Focus on revenue, pipeline movement, and whether the current system is healthy enough to scale.",
        helper: "Best when leadership needs a quick answer on performance and priorities."
    },
    manager: {
        title: "Manager view",
        description: "Track team output, spot blockers, and intervene before campaigns drift or approvals stall.",
        helper: "Best when you are coaching the team and balancing capacity against targets."
    },
    operator: {
        title: "Operator view",
        description: "Run day-to-day execution, review approvals, and act on the live operational queue.",
        helper: "Best when you are actively shipping work and resolving issues in real time."
    }
};

export function DashboardController() {
    const [persona, setPersona] = useState<Persona>("executive");
    const activePersona = personaCopy[persona];

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">View context</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">{activePersona.title}</h3>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{activePersona.description}</p>
                        <p className="mt-2 text-sm text-muted-foreground/80">{activePersona.helper}</p>
                    </div>
                    <Tabs value={persona} onValueChange={(value) => setPersona(value as Persona)} className="w-full lg:w-auto">
                        <TabsList className="grid h-10 w-full grid-cols-3 lg:min-w-[420px]">
                            <TabsTrigger value="executive" className="gap-2 text-xs">
                                <Briefcase className="h-3.5 w-3.5" /> Executive
                            </TabsTrigger>
                            <TabsTrigger value="manager" className="gap-2 text-xs">
                                <Users className="h-3.5 w-3.5" /> Manager
                            </TabsTrigger>
                            <TabsTrigger value="operator" className="gap-2 text-xs">
                                <LayoutDashboard className="h-3.5 w-3.5" /> Operator
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="min-h-[600px]">
                {persona === "executive" && <ExecutiveView />}
                {persona === "manager" && <ManagerView />}
                {persona === "operator" && <OperatorView />}
            </div>
        </div>
    );
}
