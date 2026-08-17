"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  LayoutGrid,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Palette,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PRODUCT_FLAGS } from "@/lib/productFlags";
import NotificationSettings from "@/components/dashboard/settings/NotificationSettings";

type SetupStatus = {
  hasAccount: boolean;
  isEmailVerified: boolean;
  brandingComplete: boolean;
  canSendEmail: boolean;
  hasCustomSender: boolean;
  hasLinkedInSession: boolean;
  hasExtensionApiKey: boolean;
  extensionApiBase: string;
  emailVoiceComplete: boolean;
  hasGeminiKey: boolean;
  leadCount: number;
  leadsWithEmail: number;
  campaignCount: number;
  uploadedDocCount: number;
  teamCredits: number;
  hasWhatsApp: boolean;
  edgeNodeOptional: boolean;
  edgeNodeStatus: "UP" | "DOWN" | "NOT_CONFIGURED";
  edgeNodeMessage: string;
  readyToLaunch: boolean;
  completionPercent: number;
  teamName: string;
  branding: any;
  aiConfig: any;
};

type Mailbox = {
  id: string;
  email: string;
  displayName?: string | null;
  status: string;
  dailyLimit: number;
  sentToday: number;
  minDelaySeconds: number;
  isWarmingUp: boolean;
  warmupDay: number;
  replyCount: number;
  bounceCount: number;
  lastSyncAt?: string | null;
};

type DomainCheckResult = {
  domain: string;
  selector: string;
  status: "VERIFIED" | "MISSING";
  missing: string[];
  records: Record<string, { status: "VERIFIED" | "MISSING"; host: string; values: string[] }>;
};

const STEPS = [
  { id: 1, title: "Launch Brief", icon: Users, description: "Confirm account access and the operating goal for the first campaign." },
  { id: 2, title: "Workspace Identity", icon: Palette, description: "Set the brand details used in outreach, approvals, and meeting assets." },
  { id: 3, title: "Google Workspace", icon: Mail, description: "Connect sending mailboxes, check domain records, and keep SMTP as a fallback." },
  { id: 4, title: "Optional Channels", icon: Linkedin, description: "Keep the first launch email-first, then add LinkedIn or WhatsApp context when needed." },
  { id: 5, title: "Message Voice", icon: MessageSquare, description: "Define tone, greeting, signoff, and review guidance for generated drafts." },
  { id: 6, title: "AI Drafting", icon: Bot, description: "Add the provider key used for draft preparation and enrichment support." },
  { id: 7, title: "Lead Inputs", icon: Users, description: "Import the reachable segment for review-ready campaign work." },
  { id: 8, title: "Campaign Plan", icon: Target, description: "Create the first workflow so leads, copy, and approvals have a place to land." },
  { id: 9, title: "Meeting Assets", icon: FileText, description: "Add calendar and proof links that support human-approved follow-up." },
  { id: 10, title: "Commercial Readiness", icon: CreditCard, description: "Confirm credits or billing before chargeable execution starts." },
  { id: 11, title: "Handoffs", icon: LayoutGrid, description: "Review optional infrastructure and handoff integrations." },
  { id: 12, title: "Notifications", icon: Bell, description: "Choose which email and in-app alerts your team receives." },
];

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/70";
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400";
const panelClass = "rounded-lg border border-white/10 bg-slate-900/60 p-5";

export default function SetupWizardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mailboxLoading, setMailboxLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [domainCheck, setDomainCheck] = useState<DomainCheckResult | null>(null);
  const [formData, setFormData] = useState<any>({});
  const apiBase = (process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy").replace(/\/$/, "");

  const completion = Math.max(0, Math.min(100, status?.completionPercent ?? 0));
  const connectedMailboxes = mailboxes.filter((mailbox) => mailbox.status === "CONNECTED").length;

  const stepComplete = useMemo(() => {
    if (!status) return () => false;
    return (stepId: number) => {
      if (stepId === 1) return status.hasAccount && status.isEmailVerified;
      if (stepId === 2) return status.brandingComplete;
      if (stepId === 3) return status.canSendEmail || connectedMailboxes > 0;
      if (stepId === 4) return PRODUCT_FLAGS.emailFirstBeta || status.hasLinkedInSession || status.hasExtensionApiKey;
      if (stepId === 5) return status.emailVoiceComplete;
      if (stepId === 6) return status.hasGeminiKey;
      if (stepId === 7) return status.leadCount > 0;
      if (stepId === 8) return status.campaignCount > 0;
      if (stepId === 9) return status.uploadedDocCount > 0;
      if (stepId === 10) return status.teamCredits > 0;
      if (stepId === 11) return PRODUCT_FLAGS.emailFirstBeta || status.hasWhatsApp;
      if (stepId === 12) return true;
      return false;
    };
  }, [status, connectedMailboxes]);

  async function loadStatus() {
    setLoadError(null);
    try {
      const res = await fetch(`${apiBase}/setup/status`, { cache: "no-store" });
      const data = await readJson(res);
      setStatus(data);
      setFormData({
        step2: {
          companyName: data.teamName || "",
          logoUrl: data.branding?.logoUrl || "",
          primaryColor: data.branding?.primaryColor || "#0891b2",
          accentColor: data.branding?.accentColor || "#22c55e",
          portalTitle: data.branding?.portalTitle || "",
          guidelinesUrl: data.branding?.guidelinesUrl || "",
        },
        step3: {
          host: data.aiConfig?.smtpConfig?.host || "smtp.gmail.com",
          port: data.aiConfig?.smtpConfig?.port || 587,
          secure: data.aiConfig?.smtpConfig?.secure || false,
          user: data.aiConfig?.smtpConfig?.user || "",
          password: "",
          fromName: data.aiConfig?.smtpConfig?.fromName || data.teamName || "",
          fromEmail: data.aiConfig?.smtpConfig?.fromEmail || data.aiConfig?.smtpConfig?.user || "",
          domain: data.aiConfig?.smtpConfig?.fromEmail?.split("@")[1] || "",
          selector: "google",
        },
        step5: {
          tone: data.aiConfig?.tone || "Professional",
          voice: data.aiConfig?.voice || "",
          formulation: data.aiConfig?.formulation || "Problem-Solution",
          constraints: data.aiConfig?.constraints || "",
          emailSignature: data.aiConfig?.emailSignature || "",
          greetingStyle: data.aiConfig?.greetingStyle || "Hi {firstName},",
          signOff: data.aiConfig?.signOff || "Best regards,",
        },
        step6: { geminiKey: data.aiConfig?.apiKey || "" },
        step9: {
          calendarLink: data.aiConfig?.calendarLink || "",
          demoUrl: data.aiConfig?.mediaKit?.demoUrl || "",
        },
      });
    } catch (error) {
      setStatus(null);
      setLoadError(error instanceof Error ? error.message : "Unable to load setup.");
    }
  }

  async function loadMailboxes() {
    setMailboxLoading(true);
    try {
      const res = await fetch(`${apiBase}/integrations/google/mailboxes`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) return;
      const data = await readJson(res);
      setMailboxes(Array.isArray(data.mailboxes) ? data.mailboxes : []);
    } catch {
      setMailboxes([]);
    } finally {
      setMailboxLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStep = Number(params.get("step"));
    if (requestedStep >= 1 && requestedStep <= STEPS.length) setActiveStep(requestedStep);
    if (params.get("googleMailbox") === "connected") setActiveStep(3);

    Promise.all([loadStatus(), loadMailboxes()]).finally(() => setLoading(false));
  }, []);

  async function handleSaveStep(stepId: number) {
    setSaving(true);
    setActionMessage(null);
    try {
      if (stepId === 3) {
        const smtpPayload = {
          host: formData.step3?.host,
          port: Number(formData.step3?.port || 587),
          secure: Boolean(formData.step3?.secure),
          user: formData.step3?.user,
          password: formData.step3?.password,
          fromName: formData.step3?.fromName || formData.step3?.fromEmail,
          email: formData.step3?.fromEmail || formData.step3?.user,
        };

        const res = await fetch(`${apiBase}/integrations/smtp/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(smtpPayload),
        });

        const data = await readJson(res);
        if (!res.ok) {
          throw new Error(data.error || "Failed to connect SMTP server. Please check credentials.");
        }
      } else {
        const payload = stepId === 2 ? formData.step2 : stepId === 5 ? formData.step5 : stepId === 6 ? formData.step6 : stepId === 9 ? formData.step9 : null;
        if (payload) {
          const res = await fetch(`${apiBase}/setup/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: stepId, data: payload }),
          });

          const data = await readJson(res);
          if (!res.ok) {
            throw new Error(data.error || `Failed to save setup step ${stepId}.`);
          }
        }
      }

      await loadStatus();
      await loadMailboxes();
      if (stepId < STEPS.length) setActiveStep(stepId + 1);
      else router.push("/dashboard");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to save setup step.");
    } finally {
      setSaving(false);
    }
  }

  async function connectGoogleMailbox() {
    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${apiBase}/integrations/google/oauth/start?next=${encodeURIComponent("/setup?step=3")}`);
      const data = await readJson(res);
      if (!data.authUrl) throw new Error("Google authorization URL was not returned.");
      window.location.assign(data.authUrl);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to start Google connection.");
      setSaving(false);
    }
  }

  async function syncMailbox(mailboxId: string) {
    setActionMessage("Syncing mailbox activity...");
    try {
      const res = await fetch(`${apiBase}/integrations/google/mailboxes/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId }),
      });
      const data = await readJson(res);
      setActionMessage(`Sync complete: ${data.replies ?? 0} replies, ${data.bounces ?? 0} bounces.`);
      await loadMailboxes();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to sync mailbox activity.");
    }
  }

  async function checkDomain() {
    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${apiBase}/integrations/google/domain-checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: formData.step3?.domain,
          selector: formData.step3?.selector || "google",
          mailboxId: mailboxes[0]?.id || null,
        }),
      });
      const data = await readJson(res);
      setDomainCheck(data.result);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to check DNS records.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </main>
    );
  }

  if (!status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <section className="max-w-lg rounded-lg border border-amber-400/30 bg-amber-950/20 p-6">
          <AlertTriangle className="h-6 w-6 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold text-white">Setup is unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">{loadError || "Retry status loading or sign in again."}</p>
          <button className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => { setLoading(true); loadStatus().finally(() => setLoading(false)); }}>
            Retry setup
          </button>
        </section>
      </main>
    );
  }

  const active = STEPS[activeStep - 1];
  const ActiveIcon = active.icon;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-80">
          <div className="flex h-full flex-col rounded-lg border border-white/10 bg-slate-900/70">
            <div className="border-b border-white/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Launch setup</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Readiness wizard</h1>
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Overall progress</span>
                  <span className="font-semibold text-white">{completion}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400 transition-all duration-500" style={{ width: `${completion}%` }} />
                </div>
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto p-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                const complete = stepComplete(step.id);
                const selected = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`mb-1 grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selected ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md ${selected ? "bg-slate-950 text-white" : complete ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                      {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.id}. {step.title}</span>
                      <span className={`mt-0.5 block text-xs ${selected ? "text-slate-600" : "text-slate-500"}`}>{complete ? "Ready" : "Needs review"}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="rounded-lg border border-white/10 bg-slate-900/60 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                    <ActiveIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-cyan-200">Step {activeStep} of {STEPS.length}</p>
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">{active.title}</h2>
                <p className="mt-2 max-w-2xl text-base text-slate-400">{active.description}</p>
              </div>
              <StatusPill ready={stepComplete(activeStep)} />
            </div>
          </header>

          <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); handleSaveStep(activeStep); }}>
            {activeStep === 1 && <LaunchBrief status={status} />}
            {activeStep === 2 && <WorkspaceIdentity formData={formData} setFormData={setFormData} />}
            {activeStep === 3 && (
              <GoogleWorkspaceStep
                status={status}
                formData={formData}
                setFormData={setFormData}
                mailboxes={mailboxes}
                mailboxLoading={mailboxLoading}
                actionMessage={actionMessage}
                domainCheck={domainCheck}
                onConnect={connectGoogleMailbox}
                onReload={loadMailboxes}
                onSync={syncMailbox}
                onCheckDomain={checkDomain}
                saving={saving}
              />
            )}
            {activeStep === 4 && <OptionalChannels status={status} />}
            {activeStep === 5 && <MessageVoice formData={formData} setFormData={setFormData} />}
            {activeStep === 6 && <AiDrafting formData={formData} setFormData={setFormData} status={status} />}
            {activeStep === 7 && <LeadInputs status={status} onOpenLeads={() => router.push("/leads/import")} />}
            {activeStep === 8 && <CampaignPlan status={status} onOpenCampaigns={() => router.push("/campaigns")} />}
            {activeStep === 9 && <MeetingAssets formData={formData} setFormData={setFormData} status={status} />}
            {activeStep === 10 && <CommercialReadiness status={status} />}
            {activeStep === 11 && <Handoffs status={status} />}
            {activeStep === 12 && <NotificationsStep />}

            <footer className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setActiveStep((value) => Math.max(1, value - 1))}
                disabled={activeStep === 1}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {continueLabel(activeStep)}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}

function GoogleWorkspaceStep(props: {
  status: SetupStatus;
  formData: any;
  setFormData: (value: any) => void;
  mailboxes: Mailbox[];
  mailboxLoading: boolean;
  actionMessage: string | null;
  domainCheck: DomainCheckResult | null;
  onConnect: () => void;
  onReload: () => void;
  onSync: (mailboxId: string) => void;
  onCheckDomain: () => void;
  saving: boolean;
}) {
  const connected = props.mailboxes.filter((mailbox) => mailbox.status === "CONNECTED");
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className={panelClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Connected mailboxes</h3>
            <p className="mt-1 text-sm text-slate-400">Use OAuth for Google Workspace sending, reply detection, bounce tracking, and warmup controls.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={props.onReload} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5" title="Refresh mailboxes">
              <RefreshCw className={`h-4 w-4 ${props.mailboxLoading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={props.onConnect} disabled={props.saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200">
              <Mail className="h-4 w-4" /> Connect Google
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {props.mailboxes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-slate-400">
              No Google mailboxes are connected yet. Connect the mailbox that should send approved campaign emails.
            </div>
          ) : props.mailboxes.map((mailbox) => (
            <div key={mailbox.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{mailbox.displayName || mailbox.email}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mailbox.status === "CONNECTED" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{mailbox.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{mailbox.email}</p>
                </div>
                <button type="button" onClick={() => props.onSync(mailbox.id)} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5">
                  Sync replies
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Metric label="Sent today" value={`${mailbox.sentToday}/${mailbox.dailyLimit}`} />
                <Metric label="Delay" value={`${mailbox.minDelaySeconds}s`} />
                <Metric label="Replies" value={String(mailbox.replyCount)} />
                <Metric label="Bounces" value={String(mailbox.bounceCount)} />
              </dl>
            </div>
          ))}
        </div>

        {props.actionMessage ? <p className="mt-4 rounded-lg bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">{props.actionMessage}</p> : null}
      </section>

      <section className={panelClass}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 text-cyan-300" />
          <div>
            <h3 className="text-xl font-semibold text-white">Domain readiness</h3>
            <p className="mt-1 text-sm text-slate-400">Check Google MX, SPF, DMARC, and DKIM records before scaled sending.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Sending domain">
            <input className={inputClass} value={props.formData.step3?.domain || ""} placeholder="example.com" onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, domain: event.target.value } })} />
          </Field>
          <Field label="DKIM selector">
            <input className={inputClass} value={props.formData.step3?.selector || "google"} onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, selector: event.target.value } })} />
          </Field>
        </div>

        <button type="button" onClick={props.onCheckDomain} disabled={props.saving || !props.formData.step3?.domain} className="mt-4 w-full rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50">
          Check DNS records
        </button>

        {props.domainCheck ? (
          <div className="mt-5 space-y-3">
            <StatusLine label="Overall" ready={props.domainCheck.status === "VERIFIED"} />
            {Object.entries(props.domainCheck.records).map(([key, record]) => (
              <StatusLine key={key} label={`${key.toUpperCase()} ${record.host}`} ready={record.status === "VERIFIED"} />
            ))}
            {props.domainCheck.missing.length > 0 ? (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Missing: {props.domainCheck.missing.join(", ")}</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 space-y-2 text-sm text-slate-400">
            <ChecklistItem label="At least one connected mailbox" passed={connected.length > 0 || props.status.canSendEmail} />
            <ChecklistItem label="Domain records checked for Google Workspace" passed={false} />
            <ChecklistItem label="SMTP fallback available" passed={props.status.canSendEmail} />
          </div>
        )}

        <details className="mt-5 rounded-lg border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">SMTP fallback</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="SMTP host">
              <input className={inputClass} value={props.formData.step3?.host || ""} onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, host: event.target.value } })} />
            </Field>
            <Field label="Port">
              <input className={inputClass} value={props.formData.step3?.port || ""} onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, port: event.target.value } })} />
            </Field>
            <Field label="Username">
              <input type="email" className={inputClass} value={props.formData.step3?.user || ""} onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, user: event.target.value, fromEmail: props.formData.step3?.fromEmail || event.target.value } })} />
            </Field>
            <Field label="App password">
              <input type="password" className={inputClass} value={props.formData.step3?.password || ""} onChange={(event) => props.setFormData({ ...props.formData, step3: { ...props.formData.step3, password: event.target.value } })} />
            </Field>
          </div>
        </details>
      </section>
    </div>
  );
}

function LaunchBrief({ status }: { status: SetupStatus }) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Account and launch goal</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ChecklistItem label="Account exists" passed={status.hasAccount} />
        <ChecklistItem label="Email is verified" passed={status.isEmailVerified} />
        <ChecklistItem label="Qualified lead definition reviewed" passed={false} />
        <ChecklistItem label="Meeting workflow tracking confirmed" passed={false} />
      </div>
    </section>
  );
}

function WorkspaceIdentity({ formData, setFormData }: any) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Brand details</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Company name"><input className={inputClass} value={formData.step2?.companyName || ""} onChange={(e) => setFormData({ ...formData, step2: { ...formData.step2, companyName: e.target.value } })} /></Field>
        <Field label="Portal title"><input className={inputClass} value={formData.step2?.portalTitle || ""} onChange={(e) => setFormData({ ...formData, step2: { ...formData.step2, portalTitle: e.target.value } })} /></Field>
        <Field label="Logo URL"><input className={inputClass} value={formData.step2?.logoUrl || ""} onChange={(e) => setFormData({ ...formData, step2: { ...formData.step2, logoUrl: e.target.value } })} /></Field>
        <Field label="Guidelines URL"><input className={inputClass} value={formData.step2?.guidelinesUrl || ""} onChange={(e) => setFormData({ ...formData, step2: { ...formData.step2, guidelinesUrl: e.target.value } })} /></Field>
      </div>
    </section>
  );
}

function OptionalChannels({ status }: { status: SetupStatus }) {
  return (
    <div className="space-y-5">
      <SimpleChecklist items={[["Email-first beta mode", PRODUCT_FLAGS.emailFirstBeta], ["LinkedIn session connected", status.hasLinkedInSession], ["Extension API key available", status.hasExtensionApiKey]]} />
      <ExtensionSyncToken />
    </div>
  );
}

function ExtensionSyncToken() {
  const [syncToken, setSyncToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/extension/token", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Failed to generate sync token");
        return;
      }
      setSyncToken({ token: data.token, expiresAt: data.expiresAt });
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate sync token");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    if (!syncToken) return;
    try {
      await navigator.clipboard.writeText(syncToken.token);
      toast.success("Copied to clipboard");
    } catch (error: any) {
      toast.error(error?.message || "Failed to copy to clipboard");
    }
  }

  return (
    <section className={panelClass}>
      <h3 className="text-lg font-semibold text-white">Chrome extension sync token</h3>
      <p className="mt-2 text-sm text-slate-400">
        The extension popup needs this token, separate from the shared extension key, to authenticate saved leads back to your account.
      </p>
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="mt-4 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {generating ? "Generating..." : "Generate sync token"}
      </button>
      {syncToken && (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-100">
              {syncToken.token}
            </code>
            <button type="button" onClick={copy} aria-label="Copy sync token" className="rounded-lg border border-white/10 bg-white/5 p-3 text-slate-200 hover:bg-white/10">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">Paste into the extension popup's "Sync token" field. Expires {new Date(syncToken.expiresAt).toLocaleDateString()}.</p>
        </div>
      )}
    </section>
  );
}

function MessageVoice({ formData, setFormData }: any) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Drafting voice</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Tone"><input className={inputClass} value={formData.step5?.tone || ""} onChange={(e) => setFormData({ ...formData, step5: { ...formData.step5, tone: e.target.value } })} /></Field>
        <Field label="Greeting"><input className={inputClass} value={formData.step5?.greetingStyle || ""} onChange={(e) => setFormData({ ...formData, step5: { ...formData.step5, greetingStyle: e.target.value } })} /></Field>
        <Field label="Signoff"><input className={inputClass} value={formData.step5?.signOff || ""} onChange={(e) => setFormData({ ...formData, step5: { ...formData.step5, signOff: e.target.value } })} /></Field>
        <Field label="Structure"><input className={inputClass} value={formData.step5?.formulation || ""} onChange={(e) => setFormData({ ...formData, step5: { ...formData.step5, formulation: e.target.value } })} /></Field>
      </div>
      <Field label="Review notes"><textarea className={`${inputClass} mt-5 min-h-28`} value={formData.step5?.voice || ""} onChange={(e) => setFormData({ ...formData, step5: { ...formData.step5, voice: e.target.value } })} /></Field>
    </section>
  );
}

function AiDrafting({ formData, setFormData, status }: any) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">AI provider</h3>
      <p className="mt-1 text-sm text-slate-400">Used for draft preparation. Keep approval controls separate from generation.</p>
      <Field label="Provider API key"><input type="password" className={`${inputClass} mt-5`} value={formData.step6?.geminiKey || ""} onChange={(e) => setFormData({ ...formData, step6: { ...formData.step6, geminiKey: e.target.value } })} /></Field>
      <div className="mt-4"><ChecklistItem label="Drafting key saved" passed={status.hasGeminiKey} /></div>
    </section>
  );
}

function LeadInputs({ status, onOpenLeads }: { status: SetupStatus; onOpenLeads: () => void }) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Lead segment</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="Imported leads" value={String(status.leadCount)} />
        <Metric label="Reachable by email" value={String(status.leadsWithEmail)} />
        <Metric label="Campaigns" value={String(status.campaignCount)} />
      </div>
      {status.leadCount > 0 ? (
        <div className="mt-5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 p-4 text-emerald-200 text-sm flex items-center justify-between">
          <span>Lead segment ready ({status.leadCount} leads imported). You do not need to re-upload.</span>
          <button type="button" onClick={onOpenLeads} className="text-xs text-cyan-300 hover:underline">Manage leads</button>
        </div>
      ) : (
        <button type="button" onClick={onOpenLeads} className="mt-5 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Open lead import</button>
      )}
    </section>
  );
}

function CampaignPlan({ status, onOpenCampaigns }: { status: SetupStatus; onOpenCampaigns: () => void }) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Campaign plan</h3>
      <p className="mt-1 text-sm text-slate-400">Review workflow configuration before outreach begins.</p>
      <div className="mt-5"><ChecklistItem label={status.campaignCount > 0 ? "Campaign ready" : "Needs setup"} passed={status.campaignCount > 0} /></div>
      {status.campaignCount > 0 ? (
        <div className="mt-5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 p-4 text-emerald-200 text-sm flex items-center justify-between">
          <span>Campaign workflow is active ({status.campaignCount} campaign configured). No duplicate setup required.</span>
          <button type="button" onClick={onOpenCampaigns} className="text-xs text-cyan-300 hover:underline">View campaigns</button>
        </div>
      ) : (
        <button type="button" onClick={onOpenCampaigns} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Create campaign <ExternalLink className="h-4 w-4" /></button>
      )}
    </section>
  );
}

function MeetingAssets({ formData, setFormData, status }: any) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Meeting support links</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Calendar link"><input className={inputClass} value={formData.step9?.calendarLink || ""} onChange={(e) => setFormData({ ...formData, step9: { ...formData.step9, calendarLink: e.target.value } })} /></Field>
        <Field label="Proof or demo URL"><input className={inputClass} value={formData.step9?.demoUrl || ""} onChange={(e) => setFormData({ ...formData, step9: { ...formData.step9, demoUrl: e.target.value } })} /></Field>
      </div>
      <div className="mt-4"><ChecklistItem label={`${status.uploadedDocCount} proof assets uploaded`} passed={status.uploadedDocCount > 0} /></div>
    </section>
  );
}

function CommercialReadiness({ status }: { status: SetupStatus }) {
  return <SimpleChecklist items={[["Credits available", status.teamCredits > 0], [`Credit balance: ${status.teamCredits}`, status.teamCredits > 0], ["Chargeable execution gated by balance", true]]} />;
}

function Handoffs({ status }: { status: SetupStatus }) {
  return <SimpleChecklist items={[["Advanced channels deferred safely", PRODUCT_FLAGS.emailFirstBeta], [`Edge node: ${status.edgeNodeStatus}`, status.edgeNodeOptional || status.edgeNodeStatus === "UP"], [status.edgeNodeMessage || "Core cloud workflow available", true]]} />;
}

function NotificationsStep() {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">Notification preferences</h3>
      <p className="mt-1 text-sm text-slate-400">Control which system emails and in-app alerts your team receives. Changes save immediately and can be revisited anytime in Settings.</p>
      <div className="mt-5">
        <NotificationSettings />
      </div>
    </section>
  );
}

function ActionPanel({ title, text, ready, action, onAction }: { title: string; text: string; ready: boolean; action: string; onAction: () => void }) {
  return (
    <section className={panelClass}>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
      <div className="mt-5"><ChecklistItem label={ready ? "Ready for review" : "Needs setup"} passed={ready} /></div>
      <button type="button" onClick={onAction} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">{action} <ExternalLink className="h-4 w-4" /></button>
    </section>
  );
}

function SimpleChecklist({ items }: { items: Array<[string, boolean]> }) {
  return <section className={panelClass}><div className="space-y-3">{items.map(([label, passed]) => <ChecklistItem key={label} label={label} passed={passed} />)}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>;
}

function ChecklistItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2.5">
      {passed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Circle className="h-5 w-5 text-slate-500" />}
      <span className="text-sm text-slate-200">{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-white">{value}</dd></div>;
}

function StatusLine({ label, ready }: { label: string; ready: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"><span className="truncate text-slate-300">{label}</span><StatusPill ready={ready} /></div>;
}

function StatusPill({ ready }: { ready: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{ready ? "Ready" : "Needs review"}</span>;
}

function continueLabel(stepId: number) {
  if (stepId === 3) return "Save fallback and continue";
  if (stepId === 7) return "Continue to campaign plan";
  if (stepId === 12) return "Open dashboard";
  return "Save and continue";
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}
