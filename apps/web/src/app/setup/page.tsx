"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, Circle, ChevronRight, Palette, Mail, 
  Linkedin, MessageSquare, Bot, Users, Target, FileText,
  CreditCard, LayoutGrid, Loader2, Chrome, ExternalLink, AlertTriangle
} from "lucide-react";
import { PRODUCT_FLAGS } from "@/lib/productFlags";

interface SetupStatus {
  // Same TS interface from backend...
  hasAccount: boolean;
  isEmailVerified: boolean;
  hasTeamRole: string | null;
  hasCompanyName: boolean;
  hasLogo: boolean;
  hasPrimaryColor: boolean;
  brandingComplete: boolean;
  canSendEmail: boolean;
  hasCustomSender: boolean;
  hasLinkedInSession: boolean;
  hasExtensionApiKey: boolean;
  extensionApiBase: string;
  emailVoiceComplete: boolean;
  hasGeminiKey: boolean;
  canGenerateMessage: boolean;
  leadCount: number;
  leadsWithEmail: number;
  leadsWithLinkedIn: number;
  hasHunterKey: boolean;
  campaignCount: number;
  hasVariants: boolean;
  hasAssignedLeads: boolean;
  uploadedDocCount: number;
  teamCredits: number;
  hasPaymentMethod: boolean;
  linkedInMode: string;
  hasBrowserNode: boolean;
  hasWhatsApp: boolean;
  hasGoogleOAuth: boolean;
  hasRedis: boolean;
  hasEdgeNode: boolean;
  hasSlackAlerts: boolean;
  edgeNodeAvailable: boolean;
  edgeNodeOptional: boolean;
  edgeNodeStatus: "UP" | "DOWN" | "NOT_CONFIGURED";
  edgeNodeMessage: string;
  readyToLaunch: boolean;
  completionPercent: number;
  
  // Form initial state
  teamName: string;
  branding: any;
  aiConfig: any;
}

const STEPS = [
  { id: 1, title: "Plan ICP", icon: Users, description: "Review the service-company segment, geography, and buyer profile for the first campaign run." },
  { id: 2, title: "Workspace Identity", icon: Palette, description: "Confirm the workspace identity used across campaigns and meeting assets." },
  { id: 3, title: "Gmail Readiness", icon: Mail, description: "Connect Gmail campaign sending and keep SMTP only as a fallback." },
  { id: 4, title: "Optional Channels", icon: Linkedin, description: "Keep email-first launch as default and optionally add LinkedIn context." },
  { id: 5, title: "Messaging Voice", icon: MessageSquare, description: "Define the tone used in vertical playbooks and follow-ups." },
  { id: 6, title: "Autopilot Drafting", icon: Bot, description: "Set the provider key used for campaign and follow-up drafting." },
  { id: 7, title: "Qualified Lead Inputs", icon: Users, description: "Bring in the target audience for the pilot or autopilot motion." },
  { id: 8, title: "Approve Campaign Plan", icon: Target, description: "Review the first buyer-signal-to-meeting workflow before launch." },
  { id: 9, title: "Meeting Assets", icon: FileText, description: "Add calendar links, proof assets, and conversion context." },
  { id: 10, title: "Execution Readiness", icon: CreditCard, description: "Confirm the commercial path for managed execution." },
  { id: 11, title: "Advanced Handoffs", icon: LayoutGrid, description: "Optional integrations that support follow-up and meeting workflows." },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const apiBase = (process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy").replace(/\/$/, "");

  // Fetch status on load
  const loadStatus = async () => {
    setLoadError(null);

    try {
      const res = await fetch(`${apiBase}/setup/status`);
      if (!res.ok) {
        let message = `Unable to load setup status (${res.status}).`;
        try {
          const errorData = await res.json() as Record<string, unknown>;
          if (typeof errorData["error"] === "string" && errorData["error"].length > 0) {
            message = errorData["error"];
          }
        } catch {}
        throw new Error(message);
      }

      const data = await res.json();
      setStatus(data);
      
      // Initialize form data payload from backend
      setFormData({
        step2: {
          companyName: data.teamName || "",
          logoUrl: data.branding?.logoUrl || "",
          primaryColor: data.branding?.primaryColor || "#3b82f6",
          accentColor: data.branding?.accentColor || "#10b981",
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
        },
        step5: {
          tone: data.aiConfig?.tone || "Professional",
          voice: data.aiConfig?.voice || "",
          formulation: data.aiConfig?.formulation || "Problem-Solution",
          constraints: data.aiConfig?.constraints || "",
          emailSignature: data.aiConfig?.emailSignature || "",
          greetingStyle: data.aiConfig?.greetingStyle || "Hi {firstName},",
          signOff: data.aiConfig?.signOff || "Best regards,",
          ctaStyle: data.aiConfig?.ctaStyle || "Link",
        },
        step6: {
          geminiKey: data.aiConfig?.apiKey || "",
        },
        step9: {
          calendarLink: data.aiConfig?.calendarLink || "",
          demoUrl: data.aiConfig?.mediaKit?.demoUrl || "",
        }
      });
    } catch (e: unknown) {
      console.error(e);
      setStatus(null);
      const message = e instanceof Error ? e.message : "Unable to load setup right now.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);
  const handleSaveStep = async (stepId: number) => {
    setSaving(true);
    try {
      let payload = null;
      if (stepId === 2) payload = formData.step2;
      if (stepId === 5) payload = formData.step5;
      if (stepId === 6) payload = formData.step6;
      if (stepId === 9) payload = formData.step9;

      if (stepId === 3) {
        // Save SMTP configuration using the dedicated endpoint
        await fetch(`${apiBase}/setup/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData.step3,
            port: Number(formData.step3.port)
          })
        });
        await loadStatus(); // Refresh status
      } else if (payload) {
        await fetch(`${apiBase}/setup/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: stepId, data: payload })
        });
        await loadStatus(); // Refresh status
      }
      
      // Move to next step if not the last
      if (stepId < 11) {
        setActiveStep(stepId + 1);
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-amber-500/30 bg-amber-900/10 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-white">We could not load setup right now</h2>
              <p className="mt-2 text-sm text-slate-300">{loadError || "Setup status is temporarily unavailable. Retry now or sign in again."}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                loadStatus();
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-sm transition"
            >
              Retry setup status
            </button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-sm transition border border-white/10"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper component for read-only checklist items
  const ChecklistItem = ({ label, passed }: { label: string, passed: boolean }) => (
    <div className="flex items-center space-x-3 p-3 bg-slate-900/50 rounded-lg border border-white/5">
      {passed ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
      )}
      <span className="text-slate-300 font-medium">{label}</span>
    </div>
  );

  const getContinueLabel = (stepId: number) => {
    if (stepId === 3) return "Save email settings";
    if (stepId === 7) return "Continue to campaign launch";
    if (stepId === 8) return "Continue to meeting assets";
    if (stepId === 10) return "Continue to advanced handoffs";
    if (stepId === 11) return "Go to dashboard and launch";
    return "Save and continue";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-white/10 p-6 flex flex-col shrink-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-emerald-400 bg-clip-text text-transparent">
            Start Guided Growth Pilot
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Start ICP-first: define the target segment, set the meeting outcome, approve the campaign plan, then track qualified leads and meetings.
          </p>
          <div className="mt-4 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-cyan-500 h-full transition-all duration-500"
              ref={(el) => { if (el) el.style.width = `${Math.max(0, Math.min(100, status.completionPercent))}%`; }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{status.completionPercent}% Complete</p>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            
            // Rough heuristic for checkmarks in sidebar
            let isPassed = false;
            if (step.id === 1) isPassed = status.hasAccount && status.isEmailVerified;
            if (step.id === 2) isPassed = status.brandingComplete;
            if (step.id === 3) isPassed = status.canSendEmail;
            if (step.id === 4) isPassed = PRODUCT_FLAGS.emailFirstBeta || status.hasLinkedInSession || status.hasExtensionApiKey;
            if (step.id === 5) isPassed = status.emailVoiceComplete;
            if (step.id === 6) isPassed = status.hasGeminiKey;
            if (step.id === 7) isPassed = status.leadCount > 0;
            if (step.id === 8) isPassed = status.campaignCount > 0;
            if (step.id === 9) isPassed = status.uploadedDocCount > 0;
            if (step.id === 10) isPassed = status.teamCredits > 0;
            if (step.id === 11) isPassed = PRODUCT_FLAGS.emailFirstBeta || status.hasWhatsApp;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30" 
                    : "hover:bg-slate-800/50 text-slate-400 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isActive ? "bg-cyan-500/20" : "bg-slate-800"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm text-left">{step.id}. {step.title}</span>
                </div>
                {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-12">
        <div className="max-w-3xl mx-auto">
          
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">{STEPS[activeStep - 1]?.title}</h2>
            <p className="text-slate-400 text-lg">{STEPS[activeStep - 1]?.description}</p>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleSaveStep(activeStep); }}
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl"
          >
            
            {/* --- STEP 1: Account --- */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <ChecklistItem label="Your account is ready" passed={status.hasAccount} />
                <ChecklistItem label="Your email is verified" passed={status.isEmailVerified} />
                <ChecklistItem label="Your workspace is ready" passed={status.hasTeamRole !== null} />
                <ChecklistItem label="Review ICP notes: what you sell, who to reach, industry, and geography" passed={false} />
                <ChecklistItem label="Review outcome notes: qualified lead definition and target meetings" passed={false} />
                
                <div className="mt-8">
                  <p className="text-slate-400 text-sm">Start by clarifying what you sell, who you want to reach, the industry, and the geography for this autopilot run.</p>
                  <p className="mt-2 text-slate-500 text-sm">The outcome goal should define a qualified lead and the target number of qualified meetings.</p>
                </div>
              </div>
            )}

            {/* --- STEP 2: Brand Identity --- */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Company / workspace name</label>
                  <input 
                    type="text"
                    title="Company Name"
                    value={formData.step2.companyName}
                    onChange={e => setFormData({...formData, step2: {...formData.step2, companyName: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    placeholder="Acme Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Logo URL (Optional)</label>
                  <input 
                    type="text"
                    title="Logo URL"
                    value={formData.step2.logoUrl}
                    onChange={e => setFormData({...formData, step2: {...formData.step2, logoUrl: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color (Hex)</label>
                    <div className="flex space-x-3">
                      <input 
                        type="color"
                        title="Primary Color Picker"
                        value={formData.step2.primaryColor}
                        onChange={e => setFormData({...formData, step2: {...formData.step2, primaryColor: e.target.value}})}
                        className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                      />
                      <input 
                        type="text"
                        title="Primary Color Hex"
                        placeholder="#3b82f6"
                        value={formData.step2.primaryColor}
                        onChange={e => setFormData({...formData, step2: {...formData.step2, primaryColor: e.target.value}})}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Accent Color (Hex)</label>
                    <div className="flex space-x-3">
                      <input 
                        type="color"
                        title="Accent Color Picker"
                        value={formData.step2.accentColor}
                        onChange={e => setFormData({...formData, step2: {...formData.step2, accentColor: e.target.value}})}
                        className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                      />
                      <input 
                        type="text"
                        title="Accent Color Hex"
                        placeholder="#10b981"
                        value={formData.step2.accentColor}
                        onChange={e => setFormData({...formData, step2: {...formData.step2, accentColor: e.target.value}})}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 3: Email Integration --- */}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-sky-900/20 border border-sky-500/30 rounded-xl mb-6">
                  <h3 className="text-sky-400 font-semibold mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Gmail Campaign Mailbox
                  </h3>
                  <p className="text-sky-300/80 text-sm mb-2">
                    Production campaigns should use the admin-connected Google Workspace mailbox. Use the SMTP fields below only as a fallback for system messages or legacy environments.
                  </p>
                  <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2">
                    Legacy fallback: Google App Password guide
                  </a>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Fallback SMTP Host</label>
                    <input 
                      type="text"
                      title="Fallback SMTP Host"
                      placeholder="smtp.gmail.com"
                      value={formData.step3.host}
                      onChange={e => setFormData({...formData, step3: {...formData.step3, host: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Fallback SMTP Port</label>
                    <input 
                      type="number"
                      title="Fallback SMTP Port"
                      placeholder="587"
                      value={formData.step3.port}
                      onChange={e => setFormData({...formData, step3: {...formData.step3, port: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                    <input 
                      type="email"
                      title="Email Address"
                      placeholder="you@company.com"
                      value={formData.step3.user}
                      onChange={e => setFormData({
                        ...formData, 
                        step3: {
                          ...formData.step3, 
                          user: e.target.value,
                          fromEmail: formData.step3.fromEmail === formData.step3.user ? e.target.value : formData.step3.fromEmail
                        }
                      })}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">App Password</label>
                    <input 
                      type="password"
                      title="App Password"
                      placeholder={status?.canSendEmail ? "•••••••••••••••• (Set)" : "16-char app password"}
                      value={formData.step3.password}
                      onChange={e => setFormData({...formData, step3: {...formData.step3, password: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">From Name (Display Name)</label>
                    <input 
                      type="text"
                      title="From Name"
                      placeholder="Jane Doe"
                      value={formData.step3.fromName}
                      onChange={e => setFormData({...formData, step3: {...formData.step3, fromName: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">From Email (Sender)</label>
                    <input 
                      type="email"
                      title="From Email"
                      placeholder="you@company.com"
                      value={formData.step3.fromEmail}
                      onChange={e => setFormData({...formData, step3: {...formData.step3, fromEmail: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`${apiBase}/email/verify`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ...formData.step3,
                            port: Number(formData.step3.port)
                          })
                        });
                        const result = await res.json();
                        if (result.success) {
                          alert("Connection successful!");
                        } else {
                          alert("Connection failed: " + result.error);
                        }
                      } catch (e: any) {
                        alert("Error: " + e.message);
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-sm transition"
                  >
                    Test Connection
                  </button>
                  <div className="flex flex-col gap-2">
                    <ChecklistItem label="Fallback SMTP configured" passed={status.canSendEmail} />
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 4: Optional Channels --- */}
            {activeStep === 4 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ChecklistItem label="Email-first beta mode active" passed={PRODUCT_FLAGS.emailFirstBeta} />
                  <ChecklistItem label="LinkedIn runner held back for review-first launch" passed={!PRODUCT_FLAGS.enableLinkedInAutomation} />
                  <ChecklistItem label="Chrome extension gateway configured" passed={status.hasExtensionApiKey} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Recommended</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Email-first launch path</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      Launch with Gmail sending, reply-first metrics, and approval controls. Keep open pixels as a low-trust signal.
                    </p>
                  </div>

                  <div className="rounded-xl border border-sky-500/30 bg-sky-900/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-sky-300">Optional Method</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">LinkedIn via Chrome Extension</h3>
                      </div>
                      <Chrome className="h-5 w-5 text-sky-300" />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Use the local browser extension for assisted LinkedIn tasks. This keeps session handling on the operator machine.
                    </p>
                    <ol className="mt-3 space-y-1 text-sm text-slate-300 list-decimal list-inside">
                      <li>Set <code className="text-slate-200">EXTENSION_API_KEY</code> in API env.</li>
                      <li>Load the current LinkedIn extension package in Chrome.</li>
                      <li>Configure API URL and key inside extension popup.</li>
                    </ol>
                    <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                      API Base: <span className="text-slate-100 break-all">{status.extensionApiBase || "http://localhost:3000/api/proxy/extension"}</span>
                    </div>
                    <a
                      href="/faq"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
                    >
                      View extension setup FAQ <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
                  <p className="text-sm text-slate-300">
                    Keep <code>linkedin-runner</code> automation disabled in beta. Chrome extension remains the approved optional LinkedIn method.
                  </p>
                </div>
              </div>
            )}

            {/* --- STEP 5: Email Voice & Signature --- */}
            {activeStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Writing Tone</label>
                    <select 
                      title="Writing Tone"
                      value={formData.step5.tone}
                      onChange={e => setFormData({...formData, step5: {...formData.step5, tone: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white outline-none"
                    >
                      <option>Professional</option>
                      <option>Friendly</option>
                      <option>Casual</option>
                      <option>Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Greeting Style</label>
                    <select 
                      title="Greeting Style"
                      value={formData.step5.greetingStyle}
                      onChange={e => setFormData({...formData, step5: {...formData.step5, greetingStyle: e.target.value}})}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white outline-none"
                    >
                      <option>Hi {"{firstName}"},</option>
                      <option>Dear {"{fullName}"},</option>
                      <option>{"{firstName}"} —</option>
                      <option>No greeting</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Default Message Structure</label>
                  <select
                    title="Default Message Structure"
                    value={formData.step5.formulation}
                    onChange={e => setFormData({...formData, step5: {...formData.step5, formulation: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white outline-none"
                  >
                    <option>Problem-Solution</option>
                    <option>Proof-first</option>
                    <option>Narrative</option>
                    <option>Executive Brief</option>
                    <option>Bullet-light</option>
                  </select>
                  <p className="mt-2 text-xs text-slate-400">Controls the structure and pacing of how the message is framed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Audience and messaging notes</label>
                  <textarea 
                    value={formData.step5.voice}
                    onChange={e => setFormData({...formData, step5: {...formData.step5, voice: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 h-24"
                    placeholder="Describe the target buyer, industry, geography, qualification notes, and meeting goal context."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Signature (Optional)</label>
                  <textarea 
                    value={formData.step5.emailSignature}
                    onChange={e => setFormData({...formData, step5: {...formData.step5, emailSignature: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 font-mono text-sm h-32"
                    placeholder="<b>Jane Doe</b><br>Director of Sales, Acme Corp<br><a href='...'>Book a meeting</a>"
                  />
                </div>
              </div>
            )}

            {/* --- STEP 6: AI Configuration --- */}
            {activeStep === 6 && (
              <div className="space-y-6">
                {status.hasGeminiKey ? (
                  <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl mb-6">
                    <h3 className="text-emerald-400 font-semibold mb-2">AI Provider Key Active</h3>
                    <p className="text-emerald-300/80 text-sm">
                      A global provider key is active via the environment. You can optionally override it for this team below.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Optional Team AI Key Override</label>
                  <input 
                    type="password"
                    title="AI Provider API Key"
                    value={formData.step6.geminiKey}
                    onChange={e => setFormData({...formData, step6: {...formData.step6, geminiKey: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    placeholder="AIzaSy..."
                  />
                </div>
              </div>
            )}

            {/* --- STEP 7: Lead Import --- */}
            {activeStep === 7 && (
              <div className="space-y-4">
                <ChecklistItem label={`${status.leadCount} Leads imported for review`} passed={status.leadCount > 0} />
                <ChecklistItem label={`${status.leadsWithEmail} Reachable leads with email`} passed={status.leadsWithEmail > 0} />
                <ChecklistItem label="Reachable segment available for campaign review" passed={status.leadsWithEmail > 0} />
                
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => router.push("/leads")} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors border border-white/10">
                    Add ICP Leads (CSV)
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 8: Campaign Launch --- */}
            {activeStep === 8 && (
              <div className="space-y-4">
                <ChecklistItem label={`${status.campaignCount} Campaign plans generated`} passed={status.campaignCount > 0} />
                <ChecklistItem label={`Message variants created for review`} passed={status.hasVariants} />
                <ChecklistItem label={`Leads assigned to campaign plan`} passed={status.hasAssignedLeads} />
                
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => router.push("/campaigns/new")} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors border border-cyan-400/50">
                    Generate Campaign Plan
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 9: Attachments --- */}
            {activeStep === 9 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Calendar booking link for meeting handoffs</label>
                  <input 
                    type="url"
                    title="Calendar Booking Link"
                    value={formData.step9.calendarLink}
                    onChange={e => setFormData({...formData, step9: {...formData.step9, calendarLink: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="https://calendly.com/your-name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Product Demo Video Link (Optional)</label>
                  <input 
                    type="url"
                    title="Product Demo Video Link"
                    value={formData.step9.demoUrl}
                    onChange={e => setFormData({...formData, step9: {...formData.step9, demoUrl: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>

                <div className="p-4 border border-dashed border-white/20 rounded-xl bg-slate-900/50 text-center">
                  <p className="text-sm text-slate-400 mb-3">Keep this optional for beta. A calendar link and one proof asset are enough to support the first email campaigns.</p>
                  <button type="button" onClick={() => router.push("/contact")} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">
                    Ask support for asset help
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 10: Execution Readiness --- */}
            {activeStep === 10 && (
              <div className="space-y-4">
                <ChecklistItem label={`Credits available for execution`} passed={status.teamCredits > 0} />
                <ChecklistItem label={`Billing checkout is connected`} passed={status.hasPaymentMethod} />
                
                {!status.hasPaymentMethod && (
                  <p className="text-yellow-400 text-sm mt-4">
                    Payments are not configured on this instance. Contact administrator.
                  </p>
                )}
              </div>
            )}

            {/* --- STEP 11: Advanced --- */}
            {activeStep === 11 && (
              <div className="space-y-4">
                <ChecklistItem label="Advanced channels deferred for beta" passed={PRODUCT_FLAGS.emailFirstBeta} />
                <ChecklistItem label="Google Workspace mailbox OAuth" passed={status.hasGoogleOAuth} />
                <ChecklistItem label="Redis Queue Active" passed={status.hasRedis} />
                <ChecklistItem label="Slack Alert Hooks" passed={status.hasSlackAlerts} />
                <ChecklistItem
                  label={`Edge Runtime ${status.edgeNodeOptional ? "(Optional)" : "(Required)"}`}
                  passed={status.edgeNodeAvailable || status.edgeNodeOptional}
                />

                <div className={`rounded-xl border p-4 ${
                  status.edgeNodeAvailable
                    ? "border-emerald-500/30 bg-emerald-900/10"
                    : status.edgeNodeOptional
                      ? "border-amber-500/30 bg-amber-900/10"
                      : "border-red-500/30 bg-red-900/10"
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Edge runtime status</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-300">{status.edgeNodeStatus}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{status.edgeNodeMessage}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Core email and cloud AI workflows continue without the edge node. Edge is only required for strict sovereignty,
                    residential-IP automation, and hardware-backed actions.
                  </p>
                </div>
                
                <div className="mt-8 flex justify-center">
                  <p className="text-slate-400 text-sm italic">You have reached the end of the beta readiness checklist.</p>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6">
              <button 
                type="button"
                onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                disabled={activeStep === 1}
                className="px-6 py-3 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                Back
              </button>
              
              <button 
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors border border-cyan-400/50 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{getContinueLabel(activeStep)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

    </div>
  );
}






