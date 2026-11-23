"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Info, Wrench, X } from "lucide-react";

type Banner = { message: string; level: "info" | "warning" | "maintenance" | string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STYLES: Record<string, string> = {
  info: "border-primary/30 bg-primary/10 text-primary",
  warning: "border-warning/30 bg-warning/10 text-warning",
  maintenance: "border-chart-4/30 bg-chart-4/10 text-chart-4",
};

// Site-wide notice set from the superadmin panel. Maintenance notices can't be dismissed.
export function SiteBanner() {
  const { data } = useSWR<{ banner: Banner | null }>("/api/site-banner", fetcher, { refreshInterval: 60_000 });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const banner = data?.banner;
  if (!banner || dismissed === banner.message) return null;

  const Icon = banner.level === "maintenance" ? Wrench : banner.level === "warning" ? AlertTriangle : Info;
  return (
    <div role="status" className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${STYLES[banner.level] ?? STYLES["info"]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 whitespace-pre-line">{banner.message}</p>
      {banner.level !== "maintenance" && (
        <button type="button" aria-label="Dismiss" onClick={() => setDismissed(banner.message)} className="rounded p-0.5 hover:bg-foreground/10">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
