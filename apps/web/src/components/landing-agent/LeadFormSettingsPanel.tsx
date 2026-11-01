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
    setLeadFormConsent,
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

            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Book a call button on the thank-you page, https link (optional)</span>
                <input
                    className={inputClass}
                    placeholder="https://"
                    value={draft.bookingUrl ?? ""}
                    onChange={(e) => change(setLeadFormSetting(draft, { bookingUrl: e.target.value }))}
                />
            </label>

            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Instagram handle for a follow button on the thank-you page (optional, without the @)</span>
                <input
                    className={inputClass}
                    placeholder="yourhandle"
                    value={draft.instagramHandle ?? ""}
                    onChange={(e) => change(setLeadFormSetting(draft, { instagramHandle: e.target.value }))}
                />
            </label>

            <div className="space-y-3 rounded-lg border border-white/10 p-2">
                <p className="text-xs font-medium text-slate-200">Consent</p>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={Boolean(draft.consent?.enabled)} onChange={(e) => change(setLeadFormConsent(draft, { enabled: e.target.checked }))} />
                    Consent checkbox on the form
                </label>
                {draft.consent?.enabled ? (
                    <>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Consent checkbox wording (plain text, up to 300 characters)</span>
                            <textarea
                                name="consentText"
                                className={inputClass}
                                rows={2}
                                value={draft.consent.text}
                                onChange={(e) => change(setLeadFormConsent(draft, { text: e.target.value }))}
                            />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={draft.consent.required !== false}
                                onChange={(e) => change(setLeadFormConsent(draft, { required: e.target.checked }))}
                            />
                            Required: visitors must tick it before they send the form
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Privacy policy link, https (optional)</span>
                            <input
                                className={inputClass}
                                placeholder="https://"
                                value={draft.consent.privacyUrl ?? ""}
                                onChange={(e) => change(setLeadFormConsent(draft, { privacyUrl: e.target.value }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Data deletion link, https (optional; empty uses the page built into the product)</span>
                            <input
                                className={inputClass}
                                placeholder="https://"
                                value={draft.consent.deletionUrl ?? ""}
                                onChange={(e) => change(setLeadFormConsent(draft, { deletionUrl: e.target.value }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Data deletion steps, plain text (optional, up to 2000 characters)</span>
                            <textarea
                                name="deletionSteps"
                                className={inputClass}
                                rows={3}
                                value={draft.consent.deletionSteps ?? ""}
                                onChange={(e) => change(setLeadFormConsent(draft, { deletionSteps: e.target.value }))}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Contact email for deletion requests (optional)</span>
                            <input
                                className={inputClass}
                                placeholder="privacy@yourdomain.com"
                                value={draft.consent.contactEmail ?? ""}
                                onChange={(e) => change(setLeadFormConsent(draft, { contactEmail: e.target.value }))}
                            />
                        </label>
                    </>
                ) : null}
                <p className="text-xs text-amber-200">You are responsible for the consent wording, your privacy policy and handling deletion requests.</p>
                {draft.consent?.enabled && !draft.consent.privacyUrl ? (
                    <p className="text-xs text-amber-200">Add a privacy policy link: the consent wording refers to your privacy policy.</p>
                ) : null}
            </div>

            {problem ? <p className="text-xs text-rose-300">{problem} (not saved to the page until fixed)</p> : null}
        </div>
    );
}
