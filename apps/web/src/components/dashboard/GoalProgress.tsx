"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

interface MeetingGoal {
  goal: number | null;
  booked: number;
  dayOfMonth: number;
  daysInMonth: number;
  pace: { expected: number; onPace: boolean; behindBy: number } | null;
}

const GOAL_URL = getBrowserApiUrl("/dashboard/meeting-goal");

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`meeting-goal ${res.status}`);
  return res.json();
};

// Home: meetings booked this month against the team's monthly goal, with pace. Renders
// nothing if the API route isn't available yet.
export function GoalProgress() {
  const { data, error, mutate } = useSWR<MeetingGoal>(GOAL_URL, fetcher);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (error || !data) return null;

  const startEdit = () => {
    setDraft(data.goal ? String(data.goal) : "");
    setEditing(true);
  };

  const save = async () => {
    const goal = Number(draft);
    if (!Number.isInteger(goal) || goal < 1 || goal > 1000) {
      toast.error("Enter a whole number from 1 to 1000.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(GOAL_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) throw new Error("save failed");
      await mutate(await res.json(), { revalidate: false });
      setEditing(false);
    } catch {
      toast.error("Couldn't save the goal. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const editor = (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor="meeting-goal" className="sr-only">Meetings per month</label>
      <input
        id="meeting-goal"
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="e.g. 20"
        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        autoFocus
      />
      <button type="submit" disabled={saving} className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </form>
  );

  if (!data.goal) {
    return (
      <section aria-label="Monthly meeting goal" className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-sm text-foreground">
            {data.booked} meeting{data.booked === 1 ? "" : "s"} booked this month.
          </p>
        </div>
        {editing ? editor : (
          <button type="button" onClick={startEdit} className="text-sm font-medium text-primary hover:underline">
            Set a monthly meeting goal
          </button>
        )}
      </section>
    );
  }

  const percent = Math.min(100, Math.round((data.booked / data.goal) * 100));
  return (
    <section aria-label="Monthly meeting goal" className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-muted-foreground">Monthly meeting goal</p>
        {editing ? editor : (
          <button type="button" onClick={startEdit} className="text-xs text-muted-foreground hover:text-foreground">
            Edit goal
          </button>
        )}
      </div>
      <p className="text-foreground">
        <span className="text-2xl font-medium">{data.booked}</span>
        <span className="text-sm text-muted-foreground"> / {data.goal} meetings booked this month</span>
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={data.goal}
        aria-valuenow={data.booked}
        aria-label="Meetings booked toward this month's goal"
      >
        <div className={`h-full rounded-full ${data.pace?.onPace ? "bg-success" : "bg-warning"}`} style={{ width: `${percent}%` }} />
      </div>
      {data.pace && (
        <p className={`mt-2 text-xs ${data.pace.onPace ? "text-success" : "text-warning"}`}>
          {data.pace.onPace ? "On pace" : `Behind by ${data.pace.behindBy}`}
          <span className="text-muted-foreground"> · day {data.dayOfMonth} of {data.daysInMonth}</span>
        </p>
      )}
    </section>
  );
}
