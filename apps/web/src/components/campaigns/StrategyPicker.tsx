"use client";

import { Target, Users, Timer } from "lucide-react";
import {
    guidanceFor,
    MAX_OBJECTIVE_CHARS,
    MAX_STRATEGIES,
    paceLimitsFor,
    STRATEGIES,
    STRATEGY_GROUP_LABELS,
    type StrategyGroup,
} from "@/lib/campaigns/strategies";
import { PACE_LIMITS } from "@/lib/campaigns/paceRules";

const GROUPS: StrategyGroup[] = ["approach", "check", "lens"];

const hoursText = (hours: number) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`);

// The strategies a campaign follows, with what they change. Choosing an approach suggests an
// objective and says what audience it suits; the objective stays editable.
export default function StrategyPicker({
    value,
    objective,
    onChange,
    disabled = false,
}: {
    value: string[];
    objective: string;
    onChange: (value: string[], objective: string) => void;
    disabled?: boolean;
}) {
    const guidance = guidanceFor(value);
    const limits = paceLimitsFor(value);
    const paceChanges = (Object.keys(PACE_LIMITS) as (keyof typeof PACE_LIMITS)[]).filter((key) => limits[key] !== PACE_LIMITS[key]);

    const toggle = (id: string) => {
        const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id].slice(0, MAX_STRATEGIES);
        // The suggested objective follows the choice until the user writes their own.
        const wasSuggested = !objective || objective === guidance.objective;
        onChange(next, wasSuggested ? (guidanceFor(next).objective ?? "") : objective);
    };

    return (
        <div className="space-y-4">
            {GROUPS.map((group) => {
                const items = STRATEGIES.filter((s) => s.group === group);
                return (
                    <div key={group}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{STRATEGY_GROUP_LABELS[group].title}</p>
                        <p className="mb-2 text-xs text-muted-foreground">{STRATEGY_GROUP_LABELS[group].hint}</p>
                        <div className="flex flex-wrap gap-2">
                            {items.map((strategy) => {
                                const selected = value.includes(strategy.id);
                                return (
                                    <button
                                        key={strategy.id}
                                        type="button"
                                        title={strategy.summary}
                                        aria-pressed={selected}
                                        disabled={disabled || !strategy.live}
                                        onClick={() => toggle(strategy.id)}
                                        className={`rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed ${
                                            selected
                                                ? "border-indigo-500 bg-indigo-500/10 text-foreground"
                                                : "border-border text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
                                        }`}
                                    >
                                        {strategy.name}
                                        {!strategy.live && <span className="ml-1.5 text-[10px] uppercase">Soon</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {value.length > 0 && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                    <div>
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold" htmlFor="strategy-objective">
                            <Target className="h-3.5 w-3.5" /> Objective
                        </label>
                        <input
                            id="strategy-objective"
                            type="text"
                            value={objective}
                            maxLength={MAX_OBJECTIVE_CHARS}
                            disabled={disabled}
                            onChange={(e) => onChange(value, e.target.value)}
                            placeholder="What this campaign is for"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    {guidance.icp.length > 0 && (
                        <div>
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                                <Users className="h-3.5 w-3.5" /> Who this suits
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {guidance.icp.map((text) => (
                                    <li key={text}>{text}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {paceChanges.length > 0 && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>
                                Pace checks use at least {hoursText(limits.minGapHours)} between emails, up to {limits.maxFirstWeekEmails} in the first week and {limits.maxEmails} in total.
                            </span>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
