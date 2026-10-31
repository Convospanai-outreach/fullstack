"use client";

import { useState } from "react";
import type { LeadFormConfig, LeadFormField } from "@/modules/landing-agent/leadFormConfig";
import { LEAD_FORM_MAX_FIELDS } from "@/modules/landing-agent/leadFormConfig";
import {
    addLeadFormField,
    LEAD_FORM_DEFAULT_CONFIG,
    leadFormProblem,
    moveLeadFormField,
    parseOptionLines,
    removeLeadFormField,
    setLeadFormSetting,
    updateLeadFormField,
} from "./leadFormEditor";

// Settings for the selected lead form. Every valid change is passed to onApply right away;
// an invalid one is shown here and kept until it is fixed.
interface Props {
    config: LeadFormConfig | null;
    onApply: (config: LeadFormConfig) => void;
}

const FIELD_TYPES: { value: LeadFormField["type"]; label: string }[] = [
    { value: "text", label: "Short text" },
    { value: "email", label: "Email" },
    { value: "tel", label: "Phone" },
    { value: "textarea", label: "Long text" },
    { value: "select", label: "Choice" },
    { value: "checkbox", label: "Tick box" },
];

const inputClass = "w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100";
const buttonClass = "rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40";

export default function LeadFormSettingsPanel({ config, onApply }: Props) {
    const [draft, setDraft] = useState<LeadFormConfig | null>(config);

    if (!draft) {
        return (
            <div className="space-y-2 text-sm text-slate-300">
                <p>This form block is damaged and will not show. Reset it to the default form.</p>
                <button type="button" className={buttonClass} onClick={() => onApply(LEAD_FORM_DEFAULT_CONFIG)}>
                    Reset to default form
                </button>
            </div>
        );
    }

    const problem = leadFormProblem(draft);

    function change(next: LeadFormConfig) {
        setDraft(next);
        if (!leadFormProblem(next)) onApply(next);
    }

    return (
        <div className="space-y-3 text-sm text-slate-200">
            {draft.fields.map((field, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-white/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">Field {index + 1}</span>
                        <div className="flex gap-1">
                            <button type="button" className={buttonClass} disabled={index === 0} onClick={() => change(moveLeadFormField(draft, index, -1))}>
                                Up
                            </button>
                            <button
                                type="button"
                                className={buttonClass}
                                disabled={index === draft.fields.length - 1}
                                onClick={() => change(moveLeadFormField(draft, index, 1))}
                            >
                                Down
                            </button>
                            <button type="button" className={buttonClass} disabled={draft.fields.length === 1} onClick={() => change(removeLeadFormField(draft, index))}>
                                Remove
                            </button>
                        </div>
                    </div>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-400">Label</span>
                        <input className={inputClass} value={field.label} onChange={(e) => change(updateLeadFormField(draft, index, { label: e.target.value }))} />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-400">Data key: name, email, phone, company or title fill the lead&apos;s own fields; other names are stored as answers</span>
                        <input className={inputClass} value={field.key} onChange={(e) => change(updateLeadFormField(draft, index, { key: e.target.value }))} />
                    </label>
                    <div className="flex items-center gap-3">
                        <label className="flex-1 space-y-1">
                            <span className="text-xs text-slate-400">Type</span>
                            <select
                                className={inputClass}
                                value={field.type}
                                onChange={(e) => change(updateLeadFormField(draft, index, { type: e.target.value as LeadFormField["type"] }))}
                            >
                                {FIELD_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2 pt-4 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => change(updateLeadFormField(draft, index, { required: e.target.checked }))}
                            />
                            Required
                        </label>
                    </div>
                    {field.type === "select" ? (
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Choices, one per line (up to 10)</span>
                            <textarea
                                className={inputClass}
                                rows={3}
                                key={(field.options ?? []).join("\n")}
                                defaultValue={(field.options ?? []).join("\n")}
                                onBlur={(e) => change(updateLeadFormField(draft, index, { options: parseOptionLines(e.target.value) }))}
                            />
                        </label>
                    ) : null}
                </div>
            ))}
            <button type="button" className={buttonClass} disabled={draft.fields.length >= LEAD_FORM_MAX_FIELDS} onClick={() => change(addLeadFormField(draft))}>
                Add field ({draft.fields.length}/{LEAD_FORM_MAX_FIELDS})
            </button>

            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Button text</span>
                <input className={inputClass} value={draft.buttonLabel} onChange={(e) => change(setLeadFormSetting(draft, { buttonLabel: e.target.value }))} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Message after submitting</span>
                <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.successMessage}
                    onChange={(e) => change(setLeadFormSetting(draft, { successMessage: e.target.value }))}
                />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Go to this https link after submitting (optional)</span>
                <input
                    className={inputClass}
                    placeholder="https://"
                    value={draft.redirectUrl ?? ""}
                    onChange={(e) => change(setLeadFormSetting(draft, { redirectUrl: e.target.value }))}
                />
            </label>

            {problem ? <p className="text-xs text-rose-300">{problem} (not saved to the page until fixed)</p> : null}
        </div>
    );
}
