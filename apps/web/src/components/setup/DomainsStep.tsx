"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { DNS_PROPAGATION_NOTE, emailDomainsReady, fixesFor, type DomainSignals } from "@/lib/domainSetup";

type LandingDomain = { id: string; domain: string; status: "pending" | "active" | "invalid"; ownershipVerificationName?: string | null; ownershipVerificationValue?: string | null };

const panel = "rounded-lg border border-foreground/10 bg-background/60 p-5";
const input = "w-full rounded-lg border border-foreground/10 bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70";

export default function DomainsStep() {
  const apiBase = getBrowserApiBase().replace(/\/$/, "");
  const [emailDomains, setEmailDomains] = useState<DomainSignals[]>([]);
  const [landing, setLanding] = useState<LandingDomain[]>([]);
  const [cnameTarget, setCnameTarget] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const test = useCallback(async () => {
    setTesting(true);
    setMessage(null);
    try {
      const [emailRes, landingRes] = await Promise.all([
        fetch(`${apiBase}/dashboard/deliverability`),
        fetch("/api/settings/branding/domains"),
      ]);
      const emailJson = await emailRes.json().catch(() => ({}));
      if (emailRes.ok && emailJson.ok) setEmailDomains(emailJson.stats.domains || []);
      else setMessage("We could not run the email domain test just now. Try again in a moment.");
      const landingJson = await landingRes.json().catch(() => ({}));
      setLanding(landingJson.domains || []);
      setCnameTarget(landingJson.cnameTarget || "");
      setTested(true);
    } catch {
      setMessage("We could not run the domain tests just now. Try again in a moment.");
    } finally {
      setTesting(false);
    }
  }, [apiBase]);

  useEffect(() => { void test(); }, [test]);

  async function addLanding() {
    setMessage(null);
    const res = await fetch("/api/settings/branding/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomain }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) { setMessage(json.error || "Unable to connect that domain."); return; }
    setNewDomain("");
    await test();
  }

  const active = emailDomains.filter((d) => d.active !== false);
  const ready = emailDomainsReady(emailDomains);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
        <p className="font-semibold">This step is essential. Please be patient.</p>
        <p className="mt-1">Email only reaches inboxes, and landing pages only load on your own address, once DNS is right. Testing it now means fewer problems later. {DNS_PROPAGATION_NOTE} You can continue while it is unverified; the dashboard keeps a reminder until every check passes.</p>
        <p className="mt-1">As a domain&apos;s health drops, you can add more sending domains later from the dashboard.</p>
      </div>

      <section className={panel}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Email sending domain</h3>
          <button type="button" onClick={test} disabled={testing} className="inline-flex items-center gap-2 rounded-lg bg-primary/80 px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-70">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test now
          </button>
        </div>
        {tested && active.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No sending domain yet. Connect a mailbox in the Sending Mailbox step, then test again.</p>}
        {active.map((d) => {
          const fixes = fixesFor(d);
          return (
            <div key={d.domain} className="mt-3 rounded-lg border border-foreground/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {fixes.length === 0 ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-warning" />} {d.domain}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">SPF {d.spf ? "OK" : "missing"} · DKIM {d.dkim ? "OK" : "missing"} · DMARC {d.dmarc ? "OK" : "missing"} · MX {d.mx ? "OK" : "missing"}</p>
              {fixes.map((fix) => <p key={fix.record} className="mt-2 text-xs text-warning">{fix.text}</p>)}
            </div>
          );
        })}
        {ready && <p className="mt-3 text-sm text-success">All email checks pass.</p>}
      </section>

      <section className={panel}>
        <h3 className="text-sm font-semibold text-foreground">Landing page domain (optional)</h3>
        <p className="mt-1 text-xs text-muted-foreground">Use an address like go.yourdomain.com for your landing pages. Add it here, then create the DNS records shown.</p>
        {landing.map((d) => (
          <div key={d.id} className="mt-3 rounded-lg border border-foreground/10 p-3 text-xs text-foreground/80">
            <p className="text-sm font-semibold text-foreground">{d.domain} · {d.status === "active" ? "Active" : d.status === "invalid" ? "Verification failed" : "Waiting for DNS"}</p>
            {d.status !== "active" && cnameTarget && <p className="mt-1">Add a CNAME record: {d.domain} points to {cnameTarget}</p>}
            {d.status !== "active" && d.ownershipVerificationName && <p className="mt-1">Add a TXT record: {d.ownershipVerificationName} with value {d.ownershipVerificationValue}</p>}
          </div>
        ))}
        <div className="mt-3 flex gap-2">
          <input className={input} placeholder="go.yourdomain.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <button type="button" onClick={addLanding} disabled={!newDomain.trim()} className="rounded-lg border border-foreground/10 px-4 text-sm font-semibold text-foreground disabled:opacity-50">Add</button>
        </div>
      </section>

      {message && <p className="text-sm text-warning">{message}</p>}
    </div>
  );
}
