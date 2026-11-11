"use client";

// Shown on the dashboard while a sending domain fails SPF, DKIM, DMARC or MX. It reads the same
// deliverability check as Settings > Domain Health and stays quiet if the check cannot run.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { domainBannerFor, type DomainSignals } from "@/lib/domainSetup";

export function DomainHealthBanner() {
  const [banner, setBanner] = useState<ReturnType<typeof domainBannerFor>>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getBrowserApiBase()}/dashboard/deliverability`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.ok) setBanner(domainBannerFor((json.stats?.domains || []) as DomainSignals[]));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!banner) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{banner.text}</span>
      </p>
      <Link href="/settings/domain-health" className="shrink-0 rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
        Check domains →
      </Link>
    </div>
  );
}
