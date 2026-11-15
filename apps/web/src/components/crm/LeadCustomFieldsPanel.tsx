"use client";

import { useEffect, useState, type FormEvent } from "react";

// Shows and edits a lead's custom property values. Saves only the fields that changed.
// The server checks every value against its property type and refuses unknown keys.

interface Definition {
    id: string;
    key: string;
    label: string;
    type: string;
    options: string[] | null;
}

interface Props {
    leadId: string;
    customFields: Record<string, unknown> | null | undefined;
}

function toText(value: unknown): string {
    return value === null || value === undefined ? "" : String(value);
}

export default function LeadCustomFieldsPanel({ leadId, customFields }: Props) {
    const [definitions, setDefinitions] = useState<Definition[]>([]);
    const [saved, setSaved] = useState<Record<string, string>>({});
    const [values, setValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/proxy/settings/custom-properties", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : { properties: [] }))
            .then((data: { properties?: Definition[] }) => {
                if (cancelled) return;
                const defs = data.properties ?? [];
                const initial = Object.fromEntries(defs.map((def) => [def.key, toText(customFields?.[def.key])]));
                setDefinitions(defs);
                setSaved(initial);
                setValues(initial);
            })
            .catch(() => {
                if (!cancelled) setError("Could not load custom properties");
            });
        return () => {
            cancelled = true;
        };
        // Loaded once per lead; the saved values are kept in state after that.
    }, [leadId]);

    if (definitions.length === 0) return null;

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const patch: Record<string, string | null> = {};
        for (const def of definitions) {
            const current = (values[def.key] ?? "").trim();
            if (current === (saved[def.key] ?? "")) continue;
            patch[def.key] = current === "" ? null : current;
        }
        if (Object.keys(patch).length === 0) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/proxy/leads/${leadId}/custom-fields`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                setError(data?.error ?? "Could not save the properties");
                return;
            }
            setSaved({ ...values });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-semibold">Custom properties</h3>
            {definitions.map((def) => {
                const id = `custom-field-${def.key}`;
                const value = values[def.key] ?? "";
                const onChange = (next: string) => setValues({ ...values, [def.key]: next });
                return (
                    <label key={def.key} htmlFor={id} className="block text-xs">
                        {def.label}
                        {def.type === "choice" ? (
                            <select id={id} name={def.key} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1 text-sm">
                                <option value="">Not set</option>
                                {(def.options ?? []).map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        ) : def.type === "yesno" ? (
                            <select id={id} name={def.key} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1 text-sm">
                                <option value="">Not set</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        ) : (
                            <input
                                id={id}
                                name={def.key}
                                type={def.type === "date" ? "date" : "text"}
                                inputMode={def.type === "number" ? "decimal" : undefined}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                            />
                        )}
                    </label>
                );
            })}
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                {saving ? "Saving..." : "Save properties"}
            </button>
        </form>
    );
}
