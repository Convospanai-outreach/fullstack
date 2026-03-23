"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Users, LayoutDashboard } from "lucide-react";
import ExecutiveView from "./personas/ExecutiveView";
import ManagerView from "./personas/ManagerView";
import OperatorView from "./personas/OperatorView";

type Persona = "executive" | "manager" | "operator";

export function DashboardController() {
    const [persona, setPersona] = useState<Persona>("executive");

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg border border-border/50 backdrop-blur-sm">
                <span className="text-sm font-medium text-muted-foreground px-2">View Context:</span>
                <Tabs value={persona} onValueChange={(val) => setPersona(val as Persona)} className="w-auto">
                    <TabsList className="grid w-full grid-cols-3 h-9">
                        <TabsTrigger value="executive" className="text-xs gap-2">
                            <Briefcase className="w-3.5 h-3.5" /> Executive
                        </TabsTrigger>
                        <TabsTrigger value="manager" className="text-xs gap-2">
                            <Users className="w-3.5 h-3.5" /> Manager
                        </TabsTrigger>
                        <TabsTrigger value="operator" className="text-xs gap-2">
                            <LayoutDashboard className="w-3.5 h-3.5" /> Operator
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="min-h-[600px]">
                {persona === "executive" && <ExecutiveView />}
                {persona === "manager" && <ManagerView />}
                {persona === "operator" && <OperatorView />}
            </div>
        </div>
    );
}
