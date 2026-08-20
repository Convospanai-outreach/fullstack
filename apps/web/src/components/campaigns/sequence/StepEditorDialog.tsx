"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { findStepDefinition } from "./stepDefinitions";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/crm/leadStageTransitions";
import type { SequenceStepItem } from "./SequenceCanvas";

type ConditionConfig = {
    leadStatusIn?: string[];
    leadStatusNotIn?: string[];
    pipelineStateIn?: string[];
    pipelineStateNotIn?: string[];
    hasEmail?: boolean;
};

function parseCondition(body: string | null): ConditionConfig {
    if (!body) return {};
    try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function TagInput({
    label,
    hint,
    values,
    onChange,
}: {
    label: string;
    hint: string;
    values: string[];
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState("");

    function commit() {
        const value = draft.trim();
        if (value && !values.includes(value)) onChange([...values, value]);
        setDraft("");
    }

    return (
        <div className="space-y-1.5">
            <label className="text-sm text-gray-400">{label}</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-white/10 bg-black/40 p-2">
                {values.map((v) => (
                    <span
                        key={v}
                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-foreground"
                    >
                        {v}
                        <button
                            type="button"
                            onClick={() => onChange(values.filter((x) => x !== v))}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            commit();
                        }
                    }}
                    onBlur={commit}
                    placeholder={hint}
                    className="min-w-[8rem] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
            </div>
        </div>
    );
}

function StageChips({
    label,
    selected,
    onChange,
}: {
    label: string;
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm text-gray-400">{label}</label>
            <div className="flex flex-wrap gap-1.5">
                {PIPELINE_STAGES.map((stage) => {
                    const active = selected.includes(stage);
                    return (
                        <button
                            key={stage}
                            type="button"
                            onClick={() =>
                                onChange(active ? selected.filter((s) => s !== stage) : [...selected, stage])
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${active
                                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                                    : "border-white/10 text-muted-foreground hover:bg-white/5"
                                }`}
                        >
                            {PIPELINE_LABELS[stage] || stage}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function StepEditorDialog({
    step,
    open,
    onOpenChange,
    onSave,
}: {
    step: SequenceStepItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updated: SequenceStepItem) => void;
}) {
    const def = step ? findStepDefinition(step.stepType) : undefined;

    const [delayDays, setDelayDays] = useState(0);
    const [delayHours, setDelayHours] = useState(0);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [condition, setCondition] = useState<ConditionConfig>({});

    useEffect(() => {
        if (!step) return;
        setDelayDays(step.delayDays || 0);
        setDelayHours(step.delayHours || 0);
        setSubject(step.subject || "");
        if (def?.isCondition) {
            setCondition(parseCondition(step.body));
            setBody("");
        } else {
            setBody(step.body || "");
            setCondition({});
        }
    }, [step, def?.isCondition]);

    if (!step || !def) return null;

    function handleSave() {
        if (!step) return;
        onSave({
            ...step,
            delayDays: Math.max(0, delayDays),
            delayHours: Math.max(0, Math.min(23, delayHours)),
            subject: def?.hasSubject ? subject.trim() || null : step.subject,
            body: def?.isCondition ? JSON.stringify(condition) : def?.hasMessageBody ? body.trim() || null : step.body,
        });
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{def.isCondition ? "Lead condition" : `Edit: ${def.label}`}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {!def.isCondition && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm text-gray-400">Wait (days)</label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={delayDays}
                                    onChange={(e) => setDelayDays(Number(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm text-gray-400">Wait (hours)</label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={delayHours}
                                    onChange={(e) => setDelayHours(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    )}

                    {def.hasSubject && (
                        <div className="space-y-1.5">
                            <label className="text-sm text-gray-400">Subject</label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
                        </div>
                    )}

                    {def.hasMessageBody && (
                        <div className="space-y-1.5">
                            <label className="text-sm text-gray-400">{def.hasSubject ? "Body" : "Message"}</label>
                            <Textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={def.hasSubject ? 8 : 4}
                                placeholder={def.hasSubject ? "Email body" : "Message content"}
                            />
                        </div>
                    )}

                    {def.isCondition && (
                        <>
                            <p className="text-xs text-muted-foreground">
                                A lead must match every filter set below to continue past this step. Leave a filter
                                empty to skip it.
                            </p>
                            <TagInput
                                label="Lead status is one of"
                                hint="e.g. CONTACTED, REPLIED — Enter to add"
                                values={condition.leadStatusIn || []}
                                onChange={(v) => setCondition((c) => ({ ...c, leadStatusIn: v }))}
                            />
                            <TagInput
                                label="Lead status is NOT one of"
                                hint="e.g. LOST, STOPPED — Enter to add"
                                values={condition.leadStatusNotIn || []}
                                onChange={(v) => setCondition((c) => ({ ...c, leadStatusNotIn: v }))}
                            />
                            <StageChips
                                label="Pipeline stage is one of"
                                selected={condition.pipelineStateIn || []}
                                onChange={(v) => setCondition((c) => ({ ...c, pipelineStateIn: v }))}
                            />
                            <StageChips
                                label="Pipeline stage is NOT one of"
                                selected={condition.pipelineStateNotIn || []}
                                onChange={(v) => setCondition((c) => ({ ...c, pipelineStateNotIn: v }))}
                            />
                            <div className="space-y-1.5">
                                <label className="text-sm text-gray-400">Requires an email address</label>
                                <select
                                    value={condition.hasEmail === undefined ? "any" : condition.hasEmail ? "yes" : "no"}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setCondition((c) => {
                                            const { hasEmail: _hasEmail, ...rest } = c;
                                            return v === "any" ? rest : { ...rest, hasEmail: v === "yes" };
                                        });
                                    }}
                                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground"
                                >
                                    <option value="any">Doesn&apos;t matter</option>
                                    <option value="yes">Must have an email</option>
                                    <option value="no">Must NOT have an email</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save step</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
