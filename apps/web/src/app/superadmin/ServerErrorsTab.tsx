"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

type ServerErrorEntry = {
  id: string;
  source: string;
  label: string;
  name: string | null;
  message: string;
  stack: string | null;
  createdAt: string;
};

function timeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// The details behind 500 responses: callers see only the fixed text in "Shown to the user".
export default function ServerErrorsTab({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [entries, setEntries] = useState<ServerErrorEntry[]>([]);
  const [last24h, setLast24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/superadmin/server-errors?limit=200", { cache: "no-store" });
      if (response.status === 401) return onLoggedOut();
      if (!response.ok) throw new Error(String(response.status));
      const json = await response.json();
      setEntries(json.entries || []);
      setLast24h(json.last24h || 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            Server Errors
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The real reason behind each 500 error. Users only see the text under &quot;Shown to the user&quot;; the error
            itself is kept here for 30 days. {last24h} in the last 24 hours.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
      {loading && <p className="p-4 text-xs text-muted-foreground">Loading...</p>}
      {!loading && failed && <p className="p-4 text-xs text-destructive">Couldn&apos;t load server errors.</p>}
      {!loading && !failed && entries.length === 0 && (
        <p className="p-4 text-xs text-muted-foreground">No server errors recorded.</p>
      )}
      {!loading && !failed && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">App</th>
                <th className="px-4 py-2.5">Shown to the user</th>
                <th className="px-4 py-2.5">Actual error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{timeLabel(entry.createdAt)}</td>
                  <td className="px-4 py-2 font-mono">{entry.source}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.label}</td>
                  <td className="px-4 py-2">
                    <div className="break-words font-mono">
                      {entry.name ? `${entry.name}: ` : ""}
                      {entry.message}
                    </div>
                    {entry.stack && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-muted-foreground">Stack trace</summary>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px] text-muted-foreground">
                          {entry.stack}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
