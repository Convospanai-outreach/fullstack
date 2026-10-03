"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Plan = { id: string; name: string; monthlyPrice: number; creditsPerMonth: number };

// Puts a user on a plan without payment, or ends their plan. Stripe-billed plans are
// refused by the API, since changing them here wouldn't change what Stripe charges.
export default function PlanOverride({
  userId,
  subscription,
  onChanged,
  onLoggedOut,
}: {
  userId: string;
  subscription: { status: string; gateway: string; planName: string } | null;
  onChanged: () => void;
  onLoggedOut: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/plans", { cache: "no-store" })
      .then((res) => (res.status === 401 ? (onLoggedOut(), null) : res.json()))
      .then((json) => setPlans(json?.plans || []))
      .catch(() => setPlans([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (body: Record<string, unknown>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/superadmin/users/${encodeURIComponent(userId)}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason }),
      });
      if (res.status === 401) return onLoggedOut();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMessage("Saved.");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const plan = plans.find((p) => p.id === planId);
  const active = subscription && subscription.status !== "canceled";

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
      <h4 className="font-bold uppercase text-muted-foreground">Plan override</h4>
      <p className="text-muted-foreground">
        No payment is taken. Credits aren&apos;t added automatically; adjust the team&apos;s credits separately if needed.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className="rounded border border-input bg-background px-2 py-1">
          <option value="">Choose a plan...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          aria-label="Days"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-20 rounded border border-input bg-background px-2 py-1"
        />
        <span className="text-muted-foreground">days</span>
      </div>
      <input
        aria-label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="w-full rounded border border-input bg-background px-2 py-1"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !plan || !reason.trim() || !(Number(days) >= 1)}
          onClick={() => void save({ planId, days: Number(days) }, `Put this user on ${plan?.name} for ${days} days, without payment?`)}
        >
          Set plan
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !active || !reason.trim()}
          onClick={() => void save({ planId: null }, `End this user's ${subscription?.planName} plan now?`)}
        >
          End current plan
        </Button>
      </div>
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}
