"use client";

import type { DraftStep, PropertyOption } from "./DmFlowEditor";

// The conversation as the person would see it, as chat bubbles. Text is shown as text (never as
// markup). A landing link is a label here: the real link is signed per person when it is sent.

export function DmFlowPreview({ steps, properties }: { steps: DraftStep[]; properties: PropertyOption[] }) {
    if (steps.length === 0) return <p className="text-sm text-muted-foreground">Add a step to see the conversation here.</p>;
    const labelOf = (key: string) => properties.find((p) => p.key === key)?.label ?? key;

    return (
        <div aria-label="Conversation preview" className="space-y-2 rounded-md bg-muted/40 p-3">
            {steps.map((step, index) => {
                if (step.type === "end") {
                    return (
                        <p key={index} data-bubble="end" className="text-center text-xs text-muted-foreground">
                            Flow ends
                        </p>
                    );
                }
                const text = step.text.trim() || "(empty message)";
                return (
                    <div key={index} className="space-y-2">
                        <div className="flex justify-start">
                            <div data-bubble="from-us" className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-background px-3 py-2 text-sm text-foreground">
                                {step.type === "link" ? (
                                    <>
                                        {text}
                                        <span className="mt-1 block text-xs text-primary">[landing page link]</span>
                                    </>
                                ) : (
                                    text
                                )}
                            </div>
                        </div>
                        {step.type === "question" && (
                            <div className="flex justify-end">
                                <div data-bubble="from-person" className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                                    {step.property ? `Their answer is saved to ${labelOf(step.property)}` : "Their answer is saved to a property"}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
