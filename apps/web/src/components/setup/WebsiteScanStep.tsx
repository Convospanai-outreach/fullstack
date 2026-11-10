"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/70";
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400";

type Icp = { industry: string; company_size: string; buyer_title: string; trigger_event: string; pain_statement: string };
export type CompanyProfile = {
  company_name: string;
  value_proposition: string;
  icp_primary: Icp;
  campaign_seed: { opening_hook: string; signal_keywords: string[]; subject_line_variants: string[] };
  [key: string]: unknown;
};
export type WebsiteScanState = { url: string; profile: CompanyProfile | null; createIcp: boolean };

/** What the wizard sends to /setup/save for this step; null means nothing was scanned, so nothing is saved. */
export function websiteScanPayload(state: WebsiteScanState | undefined) {
  if (!state?.profile) return null;
  return { companyProfile: state.profile, sourceUrl: state.url, createIcp: state.createIcp };
}

export default function WebsiteScanStep(props: {
  apiBase: string;
  state: WebsiteScanState;
  onChange: (next: WebsiteScanState) => void;
  savedAt?: string | null;
}) {
  const { apiBase, state, onChange, savedAt } = props;
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = state.profile;

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/setup/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The scan did not work. Try again.");
      onChange({ ...state, profile: data.profile });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan did not work. Try again.");
    } finally {
      setScanning(false);
    }
  }

  const setProfile = (patch: Partial<CompanyProfile>) => profile && onChange({ ...state, profile: { ...profile, ...patch } });
  const setIcp = (patch: Partial<Icp>) => profile && setProfile({ icp_primary: { ...profile.icp_primary, ...patch } });

  return (
    <section className="rounded-lg border border-white/10 bg-slate-900/60 p-5">
      <p className="text-sm text-slate-300">
        Enter your website and we will read it to draft who you sell to and what to say. Nothing is saved until you review it and continue.
        You can skip this step.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className={inputClass}
          placeholder="yourcompany.com"
          value={state.url}
          onChange={(e) => onChange({ ...state, url: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (state.url.trim() && !scanning) void scan(); } }}
        />
        <button
          type="button"
          onClick={() => void scan()}
          disabled={scanning || state.url.trim().length < 3}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {profile ? "Scan again" : "Scan my website"}
        </button>
      </div>
      {scanning && <p className="mt-3 text-sm text-slate-400">Reading your site. This can take up to a minute.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
      {savedAt && !profile && <p className="mt-3 text-sm text-emerald-300">Profile saved {new Date(savedAt).toLocaleDateString()}.</p>}

      {profile && (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-semibold text-white">Check and correct what we found</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={labelClass}>Company name</span><input className={inputClass} value={profile.company_name} onChange={(e) => setProfile({ company_name: e.target.value })} /></label>
            <label><span className={labelClass}>Who you sell to (job title)</span><input className={inputClass} value={profile.icp_primary.buyer_title} onChange={(e) => setIcp({ buyer_title: e.target.value })} /></label>
            <label><span className={labelClass}>Their industry</span><input className={inputClass} value={profile.icp_primary.industry} onChange={(e) => setIcp({ industry: e.target.value })} /></label>
            <label><span className={labelClass}>Their company size</span><input className={inputClass} value={profile.icp_primary.company_size} onChange={(e) => setIcp({ company_size: e.target.value })} /></label>
          </div>
          <label className="block"><span className={labelClass}>What you offer</span><textarea rows={2} className={inputClass} value={profile.value_proposition} onChange={(e) => setProfile({ value_proposition: e.target.value })} /></label>
          <label className="block"><span className={labelClass}>When they are ready to buy</span><input className={inputClass} value={profile.icp_primary.trigger_event} onChange={(e) => setIcp({ trigger_event: e.target.value })} /></label>
          <label className="block"><span className={labelClass}>Their problem before they buy</span><textarea rows={2} className={inputClass} value={profile.icp_primary.pain_statement} onChange={(e) => setIcp({ pain_statement: e.target.value })} /></label>
          <label className="block"><span className={labelClass}>Opening line for cold emails</span><textarea rows={2} className={inputClass} value={profile.campaign_seed.opening_hook} onChange={(e) => setProfile({ campaign_seed: { ...profile.campaign_seed, opening_hook: e.target.value } })} /></label>
          <label className="block"><span className={labelClass}>Keywords to find warm prospects (comma separated)</span>
            <input className={inputClass} value={profile.campaign_seed.signal_keywords.join(", ")} onChange={(e) => setProfile({ campaign_seed: { ...profile.campaign_seed, signal_keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10) } })} />
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" className="mt-1" checked={state.createIcp} onChange={(e) => onChange({ ...state, createIcp: e.target.checked })} />
            <span>Also create an ideal customer profile from this, so I can use it for campaigns.</span>
          </label>
        </div>
      )}
    </section>
  );
}
