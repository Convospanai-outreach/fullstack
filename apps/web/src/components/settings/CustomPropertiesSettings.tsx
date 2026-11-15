"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

// Settings screen for team custom lead properties. Admins create, rename and hide; members only read the list.
// The server enforces every rule (key, type, limit, role). This screen only shows its errors.

export interface CustomProperty {
    id: string;
    key: string;
    label: string;
    type: string;
    options: string[] | null;
}

const API = "/api/proxy/settings/custom-properties";

const TYPE_LABELS: Record<string, string> = {
    text: "Text",
    number: "Number",
    choice: "Select",
    yesno: "Yes / No",
    date: "Date",
};

export function parseChoiceOptions(raw: string): string[] {
    return raw
        .split(/[\n,]/)
        .map((option) => option.trim())
        .filter(Boolean);
}

async function errorMessage(res: Response, fallback: string) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? fallback;
}

export default function CustomPropertiesSettings() {
    const [properties, setProperties] = useState<CustomProperty[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({ key: "", label: "", type: "text", options: "" });

    const load = useCallback(async () => {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) {
            setError(await errorMessage(res, "Could not load custom properties"));
            return;
        }
        const data = (await res.json()) as { properties?: CustomProperty[] };
        setProperties(data.properties ?? []);
    }, []);

    useEffect(() => {
        load().catch(() => setError("Could not load custom properties"));
    }, [load]);

    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const body = {
            key: form.key.trim(),
            label: form.label.trim(),
            type: form.type,
            ...(form.type === "choice" ? { options: parseChoiceOptions(form.options) } : {}),
        };
        const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
            setError(await errorMessage(res, "Could not create the property"));
            return;
        }
        setForm({ key: "", label: "", type: "text", options: "" });
        await load();
    }

    async function rename(property: CustomProperty) {
        const label = window.prompt("New label", property.label);
        if (!label || label.trim() === property.label) return;
        const res = await fetch(`${API}/${property.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: label.trim() }),
        });
        if (!res.ok) setError(await errorMessage(res, "Could not rename the property"));
        await load();
    }

    async function hide(property: CustomProperty) {
        if (!window.confirm(`Hide "${property.label}"? Values already saved on leads are kept.`)) return;
        const res = await fetch(`${API}/${property.id}`, { method: "DELETE" });
        if (!res.ok) setError(await errorMessage(res, "Could not hide the property"));
        await load();
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-xl font-semibold">Custom properties</h1>
                <p className="text-sm text-muted-foreground">
                    Extra details for each lead, filled from landing page forms or set by hand. Hiding a property keeps the values already saved.
                </p>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <ul className="divide-y rounded-md border">
                {properties.length === 0 && <li className="p-3 text-sm text-muted-foreground">No custom properties yet.</li>}
                {properties.map((property) => (
                    <li key={property.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div>
                            <div className="font-medium">{property.label}</div>
                            <div className="text-xs text-muted-foreground">
                                {property.key} · {TYPE_LABELS[property.type] ?? property.type}
                                {property.options?.length ? ` · ${property.options.join(", ")}` : ""}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => rename(property)}>
                                Rename
                            </button>
                            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => hide(property)}>
                                Hide
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            <form id="custom-property-form" onSubmit={create} className="space-y-3 rounded-md border p-4">
                <h2 className="text-sm font-semibold">Add a property</h2>
                <label className="block text-xs">
                    Label
                    <input name="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
                </label>
                <label className="block text-xs">
                    Key (used by forms: lowercase letters, numbers, underscores)
                    <input name="key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
                </label>
                <label className="block text-xs">
                    Type
                    <select name="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm">
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>
                {form.type === "choice" && (
                    <label className="block text-xs">
                        Options (one per line or comma separated)
                        <textarea name="options" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
                    </label>
                )}
                <button type="submit" className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                    Add property
                </button>
            </form>
        </div>
    );
}
