"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

export interface SignOffDraft {
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  expiresAt: string | null;
  editable: boolean;
}

const CHANNEL_LABELS: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", linkedin: "LinkedIn", instagram: "Instagram", sms: "SMS" };

function channelLabel(channel: string) {
  return CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

// The first draft waiting for sign-off, in full: who it goes to, on which channel, the exact text, and when it
// expires (only when the approval has an expiry). Approve and Reject use the same approvals API as the Inbox.
// Edit is inline only where that API takes an edited text; other drafts are edited in the Inbox.
export function SignOffCard({ id, draft, onDecided }: { id: string; draft: SignOffDraft; onDecided: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const decide = async (action: "APPROVE" | "REJECT") => {
    setBusy(action === "APPROVE" ? "approve" : "reject");
    try {
      const edited = editing && action === "APPROVE";
      const res = await fetch(`/api/approvals/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(edited ? { body, ...(subject.trim() ? { subject } : {}) } : {}),
          ...(action === "REJECT" ? { reason: "Rejected from Home" } : {}),
        }),
      });
      if (!res.ok) throw new Error("decision failed");
      toast.success(action === "APPROVE" ? "Approved" : "Rejected");
      await onDecided();
    } catch {
      toast.error(`Couldn't ${action === "APPROVE" ? "approve" : "reject"}. Open it in the Inbox to try again.`);
    } finally {
      setBusy(null);
    }
  };

  const to = draft.recipient ? `${channelLabel(draft.channel)} to ${draft.recipient}` : channelLabel(draft.channel);

  return (
    <article aria-label="Draft waiting for your sign-off" className="glass mb-3 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-foreground">{to}</p>
        {draft.expiresAt && (
          <p className="text-xs text-muted-foreground">Expires in {formatDistanceToNowStrict(new Date(draft.expiresAt))}</p>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.subject !== null && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Message"
            rows={Math.min(14, Math.max(6, body.split("\n").length + 1))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 p-4">
          {draft.subject && <p className="mb-2 text-sm font-medium text-foreground">{draft.subject}</p>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{draft.body}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void decide("APPROVE")}
          disabled={busy !== null || (editing && !body.trim())}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : editing ? "Approve edited draft" : "Approve"}
        </button>
        {draft.editable ? (
          <button
            type="button"
            onClick={() => setEditing((on) => !on)}
            disabled={busy !== null}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {editing ? "Cancel edit" : "Edit draft"}
          </button>
        ) : (
          <Link href="/inbox?tab=approvals" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Edit draft
          </Link>
        )}
        <button
          type="button"
          onClick={() => void decide("REJECT")}
          disabled={busy !== null}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </article>
  );
}
