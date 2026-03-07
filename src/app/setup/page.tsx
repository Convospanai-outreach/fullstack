"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, Circle, ChevronRight, Palette, Mail, 
  Linkedin, MessageSquare, Bot, Users, Target, FileText, 
  CreditCard, LayoutGrid, Loader2
} from "lucide-react";

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
  readyToLaunch: boolean;
  completionPercent: number;
  
  // Form initial state
  teamName: string;
  branding: any;
  aiConfig: any;
}

const STEPS = [
  { id: 1, title: "Account & Team", icon: Users, description: "Verify your identity and team role." },
  { id: 2, title: "Brand Identity", icon: Palette, description: "Set your company name, logo, and colors." },
  { id: 3, title: "Email Integration", icon: Mail, description: "Connect your sending infrastructure." },
  { id: 4, title: "LinkedIn Connection", icon: Linkedin, description: "Enable social outreach." },
  { id: 5, title: "Email Voice", icon: MessageSquare, description: "Define your tone and writing style." },
  { id: 6, title: "AI Configuration", icon: Bot, description: "Set up Gemini API keys." },
  { id: 7, title: "Lead Import", icon: Users, description: "Bring in your target audience." },
  { id: 8, title: "Campaign Setup", icon: Target, description: "Create your first sequence." },
  { id: 9, title: "Attachments", icon: FileText, description: "Upload brochures and case studies." },
  { id: 10, title: "Billing & Credits", icon: CreditCard, description: "Ensure sufficient balance." },
  { id: 11, title: "Advanced", icon: LayoutGrid, description: "Optional webhooks & routing." },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [formData, setFormData] = useState<any>({});

  // Fetch status on load
  const loadStatus = async () => {
    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
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
          step5: {
            tone: data.aiConfig?.tone || "Professional",
            voice: data.aiConfig?.voice || "",
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
      }
    } catch (e) {
      console.error(e);
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

      if (payload) {
        await fetch("/api/setup/save", {
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

  if (loading || !status) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-white/10 p-6 flex flex-col shrink-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            ConvoSpan Setup
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Complete these 11 steps to launch your first autonomous campaign.
          </p>
          <div className="mt-4 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-500"
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
            if (step.id === 4) isPassed = status.hasLinkedInSession;
            if (step.id === 5) isPassed = status.emailVoiceComplete;
            if (step.id === 6) isPassed = status.hasGeminiKey;
            if (step.id === 7) isPassed = status.leadCount > 0;
            if (step.id === 8) isPassed = status.campaignCount > 0;
            if (step.id === 9) isPassed = status.uploadedDocCount > 0;
            if (step.id === 10) isPassed = status.teamCredits > 0;
            if (step.id === 11) isPassed = status.hasWhatsApp; // Just an example for advanced

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" 
                    : "hover:bg-slate-800/50 text-slate-400 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isActive ? "bg-blue-500/20" : "bg-slate-800"}`}>
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
                <ChecklistItem label="User Account Registered" passed={status.hasAccount} />
                <ChecklistItem label="Email Address Verified" passed={status.isEmailVerified} />
                <ChecklistItem label="Team Workspace Created" passed={status.hasTeamRole !== null} />
                
                <div className="mt-8">
                  <p className="text-slate-400 text-sm">Account foundation is strictly managed globally. No further action needed here.</p>
                </div>
              </div>
            )}

            {/* --- STEP 2: Brand Identity --- */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Company / Team Name</label>
                  <input 
                    type="text"
                    title="Company Name"
                    value={formData.step2.companyName}
                    onChange={e => setFormData({...formData, step2: {...formData.step2, companyName: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Logo URL (Optional)</label>
                  <input 
                    type="text"
                    title="Logo URL"
                    value={formData.step2.logoUrl}
                    onChange={e => setFormData({...formData, step2: {...formData.step2, logoUrl: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                  <h3 className="text-sky-400 font-semibold mb-2">SendPulse Configuration</h3>
                  <p className="text-sky-300/80 text-sm">
                    Currently, email infrastructure is managed globally via environment variables (`SENDPULSE_ID`, `SENDPULSE_SECRET`). 
                    Contact your system administrator to configure these settings.
                  </p>
                </div>
                
                <ChecklistItem label="SendPulse API Configured" passed={status.canSendEmail} />
                <ChecklistItem label="Custom Sender Configured" passed={status.hasCustomSender} />
              </div>
            )}

            {/* --- STEP 4: LinkedIn Connection --- */}
            {activeStep === 4 && (
              <div className="space-y-4">
                <ChecklistItem label={`Operating Mode: ${status?.linkedInMode || "EDGE"}`} passed={true} />
                <ChecklistItem label="Browser WebSocket Node Available" passed={!!status?.hasBrowserNode} />
                <ChecklistItem label="Active LinkedIn Session Cookie" passed={!!status?.hasLinkedInSession} />
                
                <div className="mt-8 p-4 bg-slate-800/50 border border-white/5 rounded-xl">
                  <p className="text-sm text-slate-400 text-center">
                    To connect your LinkedIn account securely via the edge extension, navigate to the LinkedIn runner page after setup.
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">Brand Voice Description</label>
                  <textarea 
                    value={formData.step5.voice}
                    onChange={e => setFormData({...formData, step5: {...formData.step5, voice: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 h-24"
                    placeholder="We sound like a trusted industry advisor, speaking with authority but never sounding pushy."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">HTML Email Signature</label>
                  <textarea 
                    value={formData.step5.emailSignature}
                    onChange={e => setFormData({...formData, step5: {...formData.step5, emailSignature: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm h-32"
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
                    <h3 className="text-emerald-400 font-semibold mb-2">Gemini API Active</h3>
                    <p className="text-emerald-300/80 text-sm">
                      A global API key is active via the environment. You can optionally override it for this team below.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tenant Override Gemini API Key (Optional)</label>
                  <input 
                    type="password"
                    title="Gemini API Key"
                    value={formData.step6.geminiKey}
                    onChange={e => setFormData({...formData, step6: {...formData.step6, geminiKey: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="AIzaSy..."
                  />
                </div>
              </div>
            )}

            {/* --- STEP 7: Lead Import --- */}
            {activeStep === 7 && (
              <div className="space-y-4">
                <ChecklistItem label={`${status.leadCount} Total Leads in Database`} passed={status.leadCount > 0} />
                <ChecklistItem label={`${status.leadsWithEmail} Leads with Email Addresses`} passed={status.leadsWithEmail > 0} />
                <ChecklistItem label={`${status.leadsWithLinkedIn} Leads with LinkedIn Profiles`} passed={status.leadsWithLinkedIn > 0} />
                
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => router.push("/dashboard/leads")} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors border border-white/10">
                    Import More Leads (CSV)
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 8: Campaign Setup --- */}
            {activeStep === 8 && (
              <div className="space-y-4">
                <ChecklistItem label={`${status.campaignCount} Campaigns Created`} passed={status.campaignCount > 0} />
                <ChecklistItem label={`Campaign Variants Designed`} passed={status.hasVariants} />
                <ChecklistItem label={`Leads Assigned to Campaigns`} passed={status.hasAssignedLeads} />
                
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => router.push("/dashboard/campaigns/new")} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors border border-blue-400/50">
                    Create New Campaign
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 9: Attachments --- */}
            {activeStep === 9 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Meeting / Calendar Booking Link</label>
                  <input 
                    type="url"
                    title="Calendar Booking Link"
                    value={formData.step9.calendarLink}
                    onChange={e => setFormData({...formData, step9: {...formData.step9, calendarLink: e.target.value}})}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500"
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
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>

                <div className="p-4 border border-dashed border-white/20 rounded-xl bg-slate-900/50 text-center">
                  <p className="text-sm text-slate-400 mb-3">Upload brochures or case studies (PDF) in the Knowledge Base area to make them available to agents.</p>
                  <button type="button" onClick={() => router.push("/dashboard/governance/playbooks")} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">
                    Manage PDFs
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 10: Billing --- */}
            {activeStep === 10 && (
              <div className="space-y-4">
                <ChecklistItem label={`Available Balance: ${status.teamCredits} Credits`} passed={status.teamCredits > 0} />
                <ChecklistItem label={`Razorpay Integration Checked`} passed={status.hasPaymentMethod} />
                
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
                <ChecklistItem label="WhatsApp Channel Configured" passed={status.hasWhatsApp} />
                <ChecklistItem label="Google OAuth SSO" passed={status.hasGoogleOAuth} />
                <ChecklistItem label="Redis Queue Active" passed={status.hasRedis} />
                <ChecklistItem label="On-Prem AI Edge Node" passed={status.hasEdgeNode} />
                <ChecklistItem label="Slack Alert Hooks" passed={status.hasSlackAlerts} />
                
                <div className="mt-8 flex justify-center">
                  <p className="text-slate-400 text-sm italic">You have reached the end of the technical audit.</p>
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
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors border border-blue-400/50 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{activeStep === 11 ? "Finish & Go to Dashboard" : "Save & Continue"}</span>
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
