"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { validateFlowSteps } from "@/lib/dmFlowSteps";
import { DmFlowEditor, draftToInput, type DraftStep, type PropertyOption } from "./DmFlowEditor";
import { DmFlowPreview } from "./DmFlowPreview";

// The "Conversation flow" part of a keyword auto-reply: attach an existing flow (or none), or create
// and edit one. Attaching is saved with the auto-reply; the flow itself is saved here.
// Platform rules (Meta, 2026-11-01): a message can be sent within 24 hours of the person's last
// message; a comment can start one message within 7 days of the comment.

type SavedStep = { type: DraftStepType; text?: string; property?: string };
type DraftStepType = DraftStep["type"];
export type DmFlow = { id: string; name: string; version: number; steps: SavedStep[] };
type Editing = { id: string | null; name: string; steps: DraftStep[] } | null;

const FLOWS_URL = getBrowserApiUrl("/content/dm-flows");
const PROPERTIES_URL = getBrowserApiUrl("/settings/custom-properties");
const NEW_FLOW = "__new";
const ARCHIVED_BLOCKER = "This flow was archived. Choose another flow or none, then save.";
const LINK_BLOCKER = "This flow sends a landing page link. Pick a landing page above.";

const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`request failed ${res.status}`);
    return res.json();
};

async function sendJson(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const res = await fetch(url, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Couldn't save. Try again.");
    return data;
}

const toDraft = (steps: SavedStep[]): DraftStep[] =>
    steps.map((step) => ({ type: step.type, text: step.text ?? "", property: step.property ?? "" }));

export function DmFlowSection({
    flowId,
    landingPageSelected,
    onFlowIdChange,
    onBlockerChange,
}: {
    flowId: string | null;
    landingPageSelected: boolean;
    onFlowIdChange: (flowId: string | null) => void;
    onBlockerChange: (message: string | null) => void;
}) {
    const flowsState = useSWR<{ flows: DmFlow[] } | null>(FLOWS_URL, fetcher);
    const propertiesState = useSWR<{ properties: { key: string; label: string; type: string; archivedAt: unknown }[] } | null>(PROPERTIES_URL, fetcher);
    const [editing, setEditing] = useState<Editing>(null);
    const [busy, setBusy] = useState(false);

    const flows = flowsState.data?.flows ?? [];
    // Only text properties: a flow's answer is free text.
    const properties: PropertyOption[] = (propertiesState.data?.properties ?? [])
        .filter((p) => p.type === "text" && !p.archivedAt)
        .map((p) => ({ key: p.key, label: p.label }));

    const attached = flows.find((flow) => flow.id === flowId) ?? null;
    const archivedAttached = Boolean(flowId) && flowsState.data !== undefined && !attached;
    const needsLandingPage = Boolean(attached?.steps.some((step) => step.type === "link")) && !landingPageSelected;
    const blocker = archivedAttached ? ARCHIVED_BLOCKER : needsLandingPage ? LINK_BLOCKER : null;

    useEffect(() => {
        onBlockerChange(blocker);
    }, [blocker, onBlockerChange]);
    useEffect(() => () => onBlockerChange(null), [onBlockerChange]);

    const validation = editing ? validateFlowSteps(draftToInput(editing.steps)) : null;
    const nameOk = Boolean(editing && editing.name.trim().length > 0 && editing.name.trim().length <= 100);
    const canSave = Boolean(validation?.ok && nameOk && !busy);

    const chooseFlow = (value: string) => {
        setEditing(null);
        if (value === NEW_FLOW) {
            setEditing({ id: null, name: "", steps: [] });
            return;
        }
        onFlowIdChange(value || null);
    };

    const saveFlow = async () => {
        if (!editing || !validation?.ok) return;
        setBusy(true);
        const body = { name: editing.name.trim(), steps: draftToInput(editing.steps) };
        try {
            if (editing.id) {
                await sendJson(`${FLOWS_URL}/${encodeURIComponent(editing.id)}`, "PATCH", body);
                toast.success("Flow saved.");
            } else {
                const created = await sendJson(FLOWS_URL, "POST", body);
                onFlowIdChange(created.flow.id);
                toast.success("Flow created. Save the auto-reply to use it.");
            }
            setEditing(null);
            await flowsState.mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save the flow.");
        } finally {
            setBusy(false);
        }
    };

    const archiveFlow = async () => {
        if (!editing?.id) return;
        if (!window.confirm("Archive this flow? Auto-replies that use it stop until you choose another flow.")) return;
        setBusy(true);
        try {
            await sendJson(`${FLOWS_URL}/${encodeURIComponent(editing.id)}`, "DELETE");
            if (flowId === editing.id) onFlowIdChange(null);
            setEditing(null);
            await flowsState.mutate();
            toast.success("Flow archived. Save the auto-reply to detach it.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't archive the flow.");
        } finally {
            setBusy(false);
        }
    };

    const selectValue = editing?.id === null ? NEW_FLOW : (flowId ?? "");

    return (
        <div className="space-y-4 rounded-md border border-border p-4">
            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Conversation flow (optional)</p>
                <p className="text-xs text-muted-foreground">
                    Instead of the message above, this auto-reply starts a short conversation. Steps go out in order. A question waits for the person&apos;s reply and saves it to a
                    custom property.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>Instagram only lets you message someone within 24 hours of their last message. A comment can start one message within 7 days of the comment; after that, the flow waits for them to write back and ends if they don&apos;t within 24 hours.</li>
                    <li>A person gets at most 6 flow messages a day.</li>
                    <li>If the person replies STOP or UNSUBSCRIBE, the flow ends and they are marked do-not-contact.</li>
                </ul>
            </div>

            <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Conversation flow</span>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={selectValue} onChange={(e) => chooseFlow(e.target.value)}>
                    <option value="">No flow: send the message above</option>
                    {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                            {flow.name}
                        </option>
                    ))}
                    {archivedAttached && (
                        <option value={flowId ?? ""} disabled>
                            This flow was archived
                        </option>
                    )}
                    <option value={NEW_FLOW}>New flow...</option>
                </select>
            </label>

            {blocker && (
                <p role="alert" className="text-sm text-destructive">
                    {blocker}
                </p>
            )}

            {attached && !editing && (
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                        {attached.name} · {attached.steps.length} steps
                    </span>
                    <button
                        type="button"
                        onClick={() => setEditing({ id: attached.id, name: attached.name, steps: toDraft(attached.steps) })}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        Edit flow
                    </button>
                </div>
            )}

            {editing && (
                <div className="space-y-4">
                    <label className="block space-y-1 text-sm">
                        <span className="font-medium text-foreground">Flow name</span>
                        <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                            value={editing.name}
                            maxLength={100}
                            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        />
                    </label>

                    <DmFlowEditor steps={editing.steps} onChange={(steps) => setEditing({ ...editing, steps })} properties={properties} />

                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Preview</p>
                        <DmFlowPreview steps={editing.steps} properties={properties} />
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                        {editing.id && (
                            <button type="button" disabled={busy} onClick={archiveFlow} className="mr-auto text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                                Archive flow
                            </button>
                        )}
                        <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-md px-4 text-sm text-muted-foreground hover:text-foreground">
                            Cancel
                        </button>
                        <button type="button" onClick={saveFlow} disabled={!canSave} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                            {editing.id ? "Save flow" : "Create flow"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
