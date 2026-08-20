"use client";

import { useMemo, useState } from "react";
import { Search, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { stepGroups, conditionGroups, StepGroup } from "./stepDefinitions";

function filterGroups(groups: StepGroup[], query: string): StepGroup[] {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
        }))
        .filter((group) => group.items.length > 0);
}

function StepGroupList({
    groups,
    linkedinLocked,
    onSelect,
    emptyMessage,
}: {
    groups: StepGroup[];
    linkedinLocked: boolean;
    onSelect: (stepType: string) => void;
    emptyMessage: string;
}) {
    return (
        <div className="mt-3 max-h-80 space-y-4 overflow-y-auto">
            {groups.map((group) => (
                <div key={group.group}>
                    <div className="mb-1 px-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {group.group}
                    </div>
                    <div className="space-y-0.5">
                        {group.items.map((item) => {
                            const locked = item.requiresLinkedIn && linkedinLocked;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => !locked && onSelect(item.id)}
                                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${locked
                                            ? "cursor-not-allowed text-muted-foreground opacity-60"
                                            : "text-foreground hover:bg-accent"
                                        }`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                    {locked && (
                                        <span className="flex items-center gap-1 text-xs">
                                            <Lock className="h-3 w-3" /> Unlock
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            {groups.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
        </div>
    );
}

export default function StepPicker({
    linkedinLocked,
    onSelect,
}: {
    linkedinLocked: boolean;
    onSelect: (stepType: string) => void;
}) {
    const [query, setQuery] = useState("");

    const filteredSteps = useMemo(() => filterGroups(stepGroups, query), [query]);
    const filteredConditions = useMemo(() => filterGroups(conditionGroups, query), [query]);

    return (
        <div className="p-3 space-y-3">
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Search steps"
                    className="pl-8"
                />
            </div>

            <Tabs defaultValue="steps">
                <TabsList className="w-full">
                    <TabsTrigger value="steps" className="flex-1">Steps</TabsTrigger>
                    <TabsTrigger value="conditions" className="flex-1">Conditions</TabsTrigger>
                </TabsList>

                <TabsContent value="steps">
                    <StepGroupList
                        groups={filteredSteps}
                        linkedinLocked={linkedinLocked}
                        onSelect={onSelect}
                        emptyMessage={`No steps match "${query}"`}
                    />
                </TabsContent>

                <TabsContent value="conditions">
                    <StepGroupList
                        groups={filteredConditions}
                        linkedinLocked={linkedinLocked}
                        onSelect={onSelect}
                        emptyMessage={`No conditions match "${query}"`}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
