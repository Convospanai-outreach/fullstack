"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "ORG_ADMIN", "CMS_EDITOR", "SALES_MANAGER", "SALES_USER", "CALLER", "VIEWER", "COMPLIANCE_OFFICER"];

// Suspend / reactivate, sign out everywhere, and platform role for one user.
export default function UserControls({
  user,
  onChanged,
  onLoggedOut,
}: {
  user: { id: string; enterpriseRole: string; suspendedAt?: string | null; suspendedReason?: string | null };
  onChanged: () => void;
  onLoggedOut: () => void;
}) {
  const [reason, setReason] = useState("");
  const [role, setRole] = useState(user.enterpriseRole);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (body: Record<string, string>, confirmText: string, done: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/superadmin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) return onLoggedOut();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMessage(done);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-xs">
      <h4 className="font-bold uppercase text-muted-foreground">Account controls</h4>

      {user.suspendedAt ? (
        <div className="space-y-2">
          <p className="text-destructive">
            Suspended {new Date(user.suspendedAt).toLocaleString()}
            {user.suspendedReason ? `: ${user.suspendedReason}` : ""}
          </p>
          <Button size="sm" disabled={busy} onClick={() => void act({ action: "reactivate" }, "Reactivate this account? The user can sign in again.", "Reactivated.")}>
            Reactivate
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="min-w-[14rem] flex-1 rounded border border-input bg-background px-2 py-1"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !reason.trim()}
            onClick={() =>
              void act(
                { action: "suspend", reason },
                "Suspend this account? They are signed out everywhere within about 30 seconds and can't sign in until reactivated.",
                "Suspended."
              )
            }
          >
            Suspend
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void act({ action: "signOut" }, "Sign this user out of every device? They can sign in again straight away.", "Signed out everywhere.")}
        >
          Sign out everywhere
        </Button>
        <select aria-label="Platform role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-input bg-background px-2 py-1">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || role === user.enterpriseRole}
          onClick={() => void act({ action: "setRole", enterpriseRole: role }, `Change this user's platform role to ${role}?`, "Role changed.")}
        >
          Change role
        </Button>
      </div>

      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}
