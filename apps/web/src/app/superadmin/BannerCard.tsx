"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

type Banner = { message: string; level: string; active: boolean; updatedAt: string };

// Edits the notice every signed-in user sees at the top of the dashboard.
export default function BannerCard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [current, setCurrent] = useState<Banner | null>(null);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const show = (banner: Banner | null) => {
    setCurrent(banner);
    if (banner) {
      setMessage(banner.message);
      setLevel(banner.level);
    }
  };

  useEffect(() => {
    fetch("/api/superadmin/banner", { cache: "no-store" })
      .then((res) => (res.status === 401 ? (onLoggedOut(), null) : res.json()))
      .then((json) => show(json?.banner ?? null))
      .catch(() => setNote("Failed to load the banner."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (active: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/superadmin/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, level, active }),
      });
      if (res.status === 401) return onLoggedOut();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      show(json.banner);
      setNote(active ? "Shown to every signed-in user within about a minute." : "Banner turned off.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
        <Megaphone className="h-4 w-4 text-cyan-400" /> Notice to all users
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {current?.active ? "Showing now at the top of every dashboard page." : "No notice is showing."} Maintenance notices can&apos;t be
        dismissed; this only shows a message and doesn&apos;t pause the app.
      </p>
      <textarea
        aria-label="Notice"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="e.g. Email sending is delayed while we fix an issue with our provider."
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className="rounded border border-input bg-background px-2 py-1">
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <Button size="sm" disabled={busy || !message.trim()} onClick={() => void save(true)}>
          {current?.active ? "Update notice" : "Show notice"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy || !current?.active} onClick={() => void save(false)}>
          Turn off
        </Button>
        {note && <span className="text-muted-foreground">{note}</span>}
      </div>
    </GlassCard>
  );
}
