"use client";

import { MAX_FLOW_STEPS, validateFlowSteps } from "@/lib/dmFlowSteps";

// The step list of an Instagram DM flow: add, remove and reorder steps. End, if present, stays last.
// Inline errors use the same checks as the API (lib/dmFlowSteps.ts).

export type DraftStepType = "message" | "question" | "link" | "end";
export type DraftStep = { type: DraftStepType; text: string; property: string };
export type PropertyOption = { key: string; label: string };

const TYPE_LABEL: Record<DraftStepType, string> = {
    message: "Message",
    question: "Question",
    link: "Landing page link",
    end: "End of flow",
};
const fieldClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const smallButton = "h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

/** The steps in the shape the API takes (text as typed; the API trims it). */
export function draftToInput(steps: DraftStep[]) {
    return steps.map((step) => {
        if (step.type === "end") return { type: "end" };
        if (step.type === "question") return { type: "question", text: step.text, property: step.property };
        return { type: step.type, text: step.text };
    });
}

export function DmFlowEditor({
    steps,
    onChange,
    properties,
}: {
    steps: DraftStep[];
    onChange: (steps: DraftStep[]) => void;
    properties: PropertyOption[];
}) {
    const endIsLast = steps[steps.length - 1]?.type === "end";
    const full = steps.length >= MAX_FLOW_STEPS;
    const validation = steps.length === 0 ? null : validateFlowSteps(draftToInput(steps));

    const insert = (step: DraftStep) => {
        const at = endIsLast ? steps.length - 1 : steps.length;
        onChange([...steps.slice(0, at), step, ...steps.slice(at)]);
    };
    const update = (index: number, patch: Partial<DraftStep>) => onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
    const remove = (index: number) => onChange(steps.filter((_, i) => i !== index));
    const move = (index: number, to: number) => {
        const next = [...steps];
        [next[index], next[to]] = [next[to]!, next[index]!];
        onChange(next);
    };

    return (
        <div className="space-y-3">
            {steps.length === 0 && <p className="text-sm text-muted-foreground">No steps yet. Add a message to start.</p>}

            <ol className="space-y-3">
                {steps.map((step, index) => {
                    const position = index + 1;
                    const next = steps[index + 1];
                    return (
                        <li key={index} className="space-y-2 rounded-md border border-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {position}. {TYPE_LABEL[step.type]}
                                </span>
                                <div className="flex gap-2">
                                    {step.type !== "end" && (
                                        <>
                                            <button
                                                type="button"
                                                aria-label={`Move step ${position} up`}
                                                disabled={index === 0}
                                                onClick={() => move(index, index - 1)}
                                                className={smallButton}
                                            >
                                                Up
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Move step ${position} down`}
                                                disabled={index === steps.length - 1 || next?.type === "end"}
                                                onClick={() => move(index, index + 1)}
                                                className={smallButton}
                                            >
                                                Down
                                            </button>
                                        </>
                                    )}
                                    <button type="button" aria-label={`Remove step ${position}`} onClick={() => remove(index)} className={smallButton}>
                                        Remove
                                    </button>
                                </div>
                            </div>

                            {step.type === "end" && <p className="text-sm text-muted-foreground">The conversation ends here.</p>}

                            {step.type === "link" && (
                                <>
                                    <textarea
                                        aria-label={`Step ${position} text`}
                                        className={fieldClass}
                                        rows={2}
                                        value={step.text}
                                        onChange={(e) => update(index, { text: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Sends the landing page you pick above, after this text.</p>
                                </>
                            )}

                            {step.type === "message" && (
                                <textarea
                                    aria-label={`Step ${position} text`}
                                    className={fieldClass}
                                    rows={2}
                                    value={step.text}
                                    onChange={(e) => update(index, { text: e.target.value })}
                                />
                            )}

                            {step.type === "question" && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <textarea
                                        aria-label={`Step ${position} text`}
                                        className={fieldClass}
                                        rows={2}
                                        value={step.text}
                                        onChange={(e) => update(index, { text: e.target.value })}
                                    />
                                    <select
                                        aria-label={`Step ${position} property`}
                                        className={fieldClass}
                                        value={step.property}
                                        onChange={(e) => update(index, { property: e.target.value })}
                                    >
                                        <option value="">Choose a custom property</option>
                                        {properties.map((p) => (
                                            <option key={p.key} value={p.key}>
                                                {p.label}
                                            </option>
                                        ))}
                                        {step.property && !properties.some((p) => p.key === step.property) && (
                                            <option value={step.property}>{step.property} (not available)</option>
                                        )}
                                    </select>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={full} onClick={() => insert({ type: "message", text: "", property: "" })} className={smallButton}>
                    Add message
                </button>
                <button type="button" disabled={full} onClick={() => insert({ type: "question", text: "", property: "" })} className={smallButton}>
                    Add question
                </button>
                <button type="button" disabled={full} onClick={() => insert({ type: "link", text: "", property: "" })} className={smallButton}>
                    Add landing page link
                </button>
                {!endIsLast && (
                    <button type="button" disabled={full} onClick={() => insert({ type: "end", text: "", property: "" })} className={smallButton}>
                        Add end
                    </button>
                )}
            </div>

            {validation && !validation.ok && (
                <p role="alert" className="text-sm text-destructive">
                    {validation.message}
                </p>
            )}
        </div>
    );
}
