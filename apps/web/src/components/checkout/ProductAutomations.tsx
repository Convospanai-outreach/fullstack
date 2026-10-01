"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

// Creator funnel automations for one product (apps/api productAutomationService.ts): the delivery
// email after payment and the cart-abandon sequence. Saved switched off; switching on lets them
// send on their own, and only for checkouts started after that.

type Automation = {
    deliveryUrl: string | null;
    deliveryMailboxId: string | null;
    cartAbandonSequenceId: string | null;
    cartAbandonHours: number | null;
    active: boolean;
    activatedAt: string | null;
};

type AutomationData = {
    automation: Automation;
    mailboxes: { id: string; email: string }[];
    sequences: { id: string; name: string; usable: boolean }[];
    recentDeliveries: { id: string; deliveryStatus: string; deliveryError: string | null; updatedAt: string }[];
};

type Draft = { deliveryUrl: string; deliveryMailboxId: string; cartAbandonSequenceId: string; cartAbandonHours: string };

// 404 = the creator funnel isn't on for this team: show nothing.
const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`automations ${res.status}`);
    return res.json();
};

async function put(url: string, body: unknown) {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Couldn't save. Try again.");
    return data;
}

const toDraft = (a: Automation): Draft => ({
    deliveryUrl: a.deliveryUrl ?? "",
    deliveryMailboxId: a.deliveryMailboxId ?? "",
    cartAbandonSequenceId: a.cartAbandonSequenceId ?? "",
    cartAbandonHours: a.cartAbandonHours != null ? String(a.cartAbandonHours) : "",
});

const fieldClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function ProductAutomations({ productId }: { productId: string }) {
    const url = getBrowserApiUrl(`/checkout/products/${encodeURIComponent(productId)}/automation`);
    const { data, error, mutate } = useSWR<AutomationData | null>(url, fetcher);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);

    if (error || !data) return null;
    const { automation } = data;

    const run = async (body: unknown, done: string) => {
        setBusy(true);
        try {
            await put(url, body);
            toast.success(done);
            setDraft(null);
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save.");
        } finally {
            setBusy(false);
        }
    };

    const save = () => {
        if (!draft) return;
        const hours = draft.cartAbandonHours.trim();
        void run(
            {
                deliveryUrl: draft.deliveryUrl.trim() || null,
                deliveryMailboxId: draft.deliveryMailboxId || null,
                cartAbandonSequenceId: draft.cartAbandonSequenceId || null,
                cartAbandonHours: hours ? Number(hours) : null,
            },
            automation.active ? "Saved." : "Saved. Switch it on when you're ready.",
        );
    };

    const toggle = () =>
        run({ active: !automation.active }, automation.active ? "Switched off." : "Switched on. New checkouts get these emails automatically.");

    return (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                    Funnel automations: <strong className="text-foreground">{automation.active ? "On" : "Off"}</strong>
                    {automation.deliveryUrl ? " · delivery email" : ""}
                    {automation.cartAbandonSequenceId ? ` · cart-abandon after ${automation.cartAbandonHours}h` : ""}
                </span>
                <span className="flex gap-2">
                    <button type="button" className="text-primary hover:underline disabled:opacity-50" disabled={busy} onClick={() => setDraft(draft ? null : toDraft(automation))}>
                        {draft ? "Close" : "Edit"}
                    </button>
                    <button type="button" className="text-primary hover:underline disabled:opacity-50" disabled={busy} onClick={toggle}>
                        {automation.active ? "Switch off" : "Switch on"}
                    </button>
                </span>
            </div>

            {draft && (
                <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                        After payment, the buyer gets an email with the delivery link from the mailbox you pick. If someone starts checkout
                        and doesn&apos;t pay within the hours you set, they join the cart-abandon sequence. Only buyers who are already
                        leads get the cart-abandon sequence.
                    </p>
                    <div className="space-y-1">
                        <label htmlFor={`delivery-url-${productId}`} className="text-xs text-muted-foreground">Delivery link (https)</label>
                        <input id={`delivery-url-${productId}`} className={fieldClass} placeholder="https://your-school.example/course" value={draft.deliveryUrl}
                            onChange={(e) => setDraft({ ...draft, deliveryUrl: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor={`delivery-mailbox-${productId}`} className="text-xs text-muted-foreground">Send it from</label>
                        <select id={`delivery-mailbox-${productId}`} className={fieldClass} value={draft.deliveryMailboxId}
                            onChange={(e) => setDraft({ ...draft, deliveryMailboxId: e.target.value })}>
                            <option value="">Pick a mailbox</option>
                            {data.mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                        <div className="space-y-1">
                            <label htmlFor={`abandon-seq-${productId}`} className="text-xs text-muted-foreground">Cart-abandon sequence</label>
                            <select id={`abandon-seq-${productId}`} className={fieldClass} value={draft.cartAbandonSequenceId}
                                onChange={(e) => setDraft({ ...draft, cartAbandonSequenceId: e.target.value })}>
                                <option value="">None</option>
                                {data.sequences.map((s) => (
                                    <option key={s.id} value={s.id} disabled={!s.usable}>{s.name}{s.usable ? "" : " (has steps a nurture can't run)"}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label htmlFor={`abandon-hours-${productId}`} className="text-xs text-muted-foreground">After (hours)</label>
                            <input id={`abandon-hours-${productId}`} type="number" min={1} max={168} className={fieldClass} value={draft.cartAbandonHours}
                                onChange={(e) => setDraft({ ...draft, cartAbandonHours: e.target.value })} />
                        </div>
                    </div>
                    <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" disabled={busy} onClick={save}>
                        {busy ? "Saving..." : "Save"}
                    </button>
                </div>
            )}

            {data.recentDeliveries.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                    {data.recentDeliveries.map((d) => (
                        <li key={d.id}>
                            Delivery {d.deliveryStatus.toLowerCase()} · {new Date(d.updatedAt).toLocaleString()}
                            {d.deliveryError ? <span className="text-destructive"> · {d.deliveryError}</span> : null}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
