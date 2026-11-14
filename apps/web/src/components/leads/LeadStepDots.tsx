export interface LeadStepSummary {
    key: string;
    label: string;
    state: "done" | "active" | "waiting" | "blocked" | "todo";
    detail: string | null;
}

const DOT: Record<LeadStepSummary["state"], string> = {
    done: "bg-emerald-500",
    active: "bg-primary",
    waiting: "bg-amber-500",
    blocked: "bg-red-500",
    todo: "bg-muted-foreground/25",
};

const STATE_WORD: Record<LeadStepSummary["state"], string> = {
    done: "done",
    active: "in progress",
    waiting: "waiting",
    blocked: "blocked",
    todo: "not started",
};

// Compact six-step rail for a lead card: one dot per step, with the current step named beside it.
export function LeadStepDots({ steps }: { steps: LeadStepSummary[] }) {
    const current = steps.find((s) => s.state !== "done");
    return (
        <div className="flex items-center gap-2" aria-label="Governed workflow progress">
            <ol className="flex items-center gap-1">
                {steps.map((step) => (
                    <li
                        key={step.key}
                        className={`h-1.5 w-4 rounded-full ${DOT[step.state]}`}
                        title={`${step.label}: ${step.detail ?? STATE_WORD[step.state]}`}
                    />
                ))}
            </ol>
            <span className="text-[10px] text-muted-foreground truncate">
                {current ? `${current.label} · ${STATE_WORD[current.state]}` : "All steps done"}
            </span>
        </div>
    );
}
