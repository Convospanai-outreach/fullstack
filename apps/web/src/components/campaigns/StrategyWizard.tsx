"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
    Bot,
    CheckCircle2,
    ChevronRight,
    LayoutTemplate,
    Linkedin,
    Mail,
    PenTool,
    Search,
    Share2,
    ShieldCheck,
    Upload,
    Users,
    Zap
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { IntelCapsule, IntelSignal } from "@/components/intel/IntelCapsule";

export type WizardStep = "channel" | "autonomy" | "audience" | "messaging" | "review";
export type ChannelType = "linkedin" | "email" | "omnichannel";
export type ExecutionMode = "saferun" | "hybrid" | "autonomous";
type AudienceSource = "csv" | "hunter" | "manual";
type ToneOption = "Professional" | "Friendly" | "Consultative" | "Direct";
type VoiceOption = "Founder" | "Operator" | "Advisor" | "Peer" | "Analyst";
type FormulationOption = "Problem-Solution" | "Proof-first" | "Narrative" | "Executive Brief" | "Bullet-light";

interface CampaignWizardConfig {
    channel: ChannelType;
    executionMode: ExecutionMode;
    audienceSource: AudienceSource;
    campaignName: string;
    customMessage: string;
    tone: ToneOption;
    voice: VoiceOption;
    formulation: FormulationOption;
    intelSignalId: string;
    variantSubject: string;
    variantBody: string;
}

const DEFAULT_CONFIG: CampaignWizardConfig = {
    channel: "linkedin",
    executionMode: "saferun",
    audienceSource: "csv",
    campaignName: "",
    customMessage: "",
    tone: "Professional",
    voice: "Operator",
    formulation: "Problem-Solution",
    intelSignalId: "",
    variantSubject: "",
    variantBody: ""
};

const WIZARD_STEPS: {
    id: WizardStep;
    label: string;
    title: string;
    description: string;
    helper: string;
    icon: typeof Share2;
}[] = [
    {
        id: "channel",
        label: "Channel",
        title: "Choose where outreach starts",
        description: "Pick the channel that best matches how buyers prefer to hear from you.",
        helper: "This decides the delivery surface and the sequence preview shown later.",
        icon: Share2
    },
    {
        id: "autonomy",
        label: "Control",
        title: "Set the approval level",
        description: "Define how much the system can do on its own before a human review step.",
        helper: "SafeRun is best for first launches and regulated teams.",
        icon: ShieldCheck
    },
    {
        id: "audience",
        label: "Audience",
        title: "Tell the system where leads come from",
        description: "Select the source so the campaign can launch with the right assumptions.",
        helper: "You can change the source later from the campaign detail page.",
        icon: Users
    },
    {
        id: "messaging",
        label: "Message",
        title: "Add the campaign brief users will understand",
        description: "Give the campaign a clear name and a short message brief before launch.",
        helper: "The review step uses this brief to explain what will happen next.",
        icon: PenTool
    },
    {
        id: "review",
        label: "Review",
        title: "Confirm the launch plan",
        description: "Check the campaign summary, safety mode, and next actions before creating it.",
        helper: "Launching creates the campaign and opens the detail page for follow-up setup.",
        icon: CheckCircle2
    }
];

const CHANNEL_OPTIONS: {
    id: ChannelType;
    label: string;
    desc: string;
    detail: string;
    icon: typeof Linkedin;
    iconClassName: string;
    selectedClassName: string;
}[] = [
    {
        id: "linkedin",
        label: "LinkedIn Outreach",
        desc: "Best when warm introductions and profile context matter.",
        detail: "Use this when your team wants high-context, relationship-led outreach.",
        icon: Linkedin,
        iconClassName: "text-sky-400",
        selectedClassName: "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30"
    },
    {
        id: "email",
        label: "Email Outreach",
        desc: "Best for direct outreach with a connected inbox and deliverability controls.",
        detail: "Use this when speed, volume, and follow-up sequencing matter most.",
        icon: Mail,
        iconClassName: "text-violet-400",
        selectedClassName: "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
    },
    {
        id: "omnichannel",
        label: "Omnichannel",
        desc: "Start in one channel and follow up in another for better coverage.",
        detail: "Use this when the team wants wider reach with a single campaign brief.",
        icon: Share2,
        iconClassName: "text-emerald-400",
        selectedClassName: "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
    }
];

const EXECUTION_MODES: {
    id: ExecutionMode;
    label: string;
    desc: string;
    detail: string;
    icon: typeof ShieldCheck;
    iconClassName: string;
    badge?: string;
}[] = [
    {
        id: "saferun",
        label: "SafeRun Assisted",
        desc: "Your team reviews every message before anything sends.",
        detail: "Recommended for first launches, new messaging, and sensitive accounts.",
        icon: ShieldCheck,
        iconClassName: "text-emerald-400",
        badge: "Recommended"
    },
    {
        id: "hybrid",
        label: "Hybrid Autonomy",
        desc: "The system drafts and routes low-confidence items back for review.",
        detail: "Best when you want speed while keeping a clear approval fallback.",
        icon: Zap,
        iconClassName: "text-amber-400"
    },
    {
        id: "autonomous",
        label: "Guided automation",
        desc: "The system prepares drafts and actions with configured review controls.",
        detail: "Best for mature playbooks with proven guardrails and messaging review.",
        icon: Bot,
        iconClassName: "text-rose-400",
        badge: "Advanced"
    }
];

const AUDIENCE_OPTIONS: {
    id: AudienceSource;
    label: string;
    desc: string;
    detail: string;
    icon: typeof Upload;
    iconClassName: string;
    selectedClassName: string;
}[] = [
    {
        id: "csv",
        label: "CSV Import",
        desc: "Bring in a prepared list of leads from your team or CRM export.",
        detail: "Best when your team already knows which accounts or contacts to target.",
        icon: Upload,
        iconClassName: "text-sky-400",
        selectedClassName: "border-sky-500 bg-sky-500/10"
    },
    {
        id: "hunter",
        label: "Hunter Search",
        desc: "Start with domains and enrich email contacts before outreach begins.",
        detail: "Best when you know the accounts but still need verified contact data.",
        icon: Search,
        iconClassName: "text-amber-400",
        selectedClassName: "border-amber-500 bg-amber-500/10"
    },
    {
        id: "manual",
        label: "Manual Entry",
        desc: "Paste a short list of names, emails, or profile URLs for a focused launch.",
        detail: "Best for small pilots, executive outreach, and hand-picked accounts.",
        icon: PenTool,
        iconClassName: "text-fuchsia-400",
        selectedClassName: "border-fuchsia-500 bg-fuchsia-500/10"
    }
];

const CHANNEL_SEQUENCE: Record<ChannelType, string[]> = {
    linkedin: ["Connection request", "Follow-up note after acceptance"],
    email: ["Intro email", "Follow-up email two days later"],
    omnichannel: ["LinkedIn touch", "Email follow-up", "Final reminder"],
};

const DEFAULT_PREVIEW = "Hi {firstName},\n\nI noticed your team is scaling quickly. We help teams remove manual work from outbound execution without losing control.\n\nWould a short conversation next week be useful?\n\nBest,\n[Your Name]";
function getDisabledReason(step: WizardStep, config: CampaignWizardConfig) {
    if (step === "audience" && !config.audienceSource) {
        return "Choose an audience source before moving on.";
    }

    if (step === "messaging") {
        if (!config.campaignName.trim()) {
            return "Add a campaign name so the team can identify this launch later.";
        }

        if (!config.customMessage.trim()) {
            return "Add a short campaign brief so the messaging preview is clear.";
        }
    }

    return "";
}

function formatAudience(source: AudienceSource) {
    return AUDIENCE_OPTIONS.find((option) => option.id === source)?.label ?? "Not selected";
}

function buildPreview(config: CampaignWizardConfig) {
    if (!config.customMessage.trim()) {
        return DEFAULT_PREVIEW;
    }

    return [
        "Hi {firstName},",
        "",
        config.customMessage.trim(),
        "",
        "Would you be open to a short conversation next week?",
        "",
        "Best,",
        "[Your Name]"
    ].join("\n");
}

export default function StrategyWizard({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState<WizardStep>("channel");
    const [config, setConfig] = useState<CampaignWizardConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const saved = localStorage.getItem("campaign_wizard_draft");
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved) as Partial<CampaignWizardConfig>;
            setConfig({ ...DEFAULT_CONFIG, ...parsed });
            toast.info("Restored your draft.");
        } catch (error) {
            console.error("Failed to restore draft", error);
        }
    }, []);

    useEffect(() => {
        const intelSignalId = searchParams.get("intelSignalId")?.trim();
        if (!intelSignalId) {
            return;
        }

        setConfig((current) => (current.intelSignalId ? current : { ...current, intelSignalId }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        localStorage.setItem("campaign_wizard_draft", JSON.stringify(config));
    }, [config]);

    const currentStepIndex = WIZARD_STEPS.findIndex((item) => item.id === step);
    const activeStep = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0]!;
    const progress = Math.round(((currentStepIndex + 1) / WIZARD_STEPS.length) * 100);
    const nextDisabledReason = getDisabledReason(step, config);
    const canContinue = !nextDisabledReason;

    const updateConfig = (updates: Partial<CampaignWizardConfig>) => {
        setConfig((current) => ({ ...current, ...updates }));
    };

    const handleNext = () => {
        if (!canContinue) {
            toast.error(nextDisabledReason);
            return;
        }

        const nextStep = WIZARD_STEPS[currentStepIndex + 1];
        if (nextStep) {
            setStep(nextStep.id);
        }
    };

    const handleBack = () => {
        const previousStep = WIZARD_STEPS[currentStepIndex - 1];
        if (previousStep) {
            setStep(previousStep.id);
            return;
        }

        onClose();
    };

    const handleLaunch = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/proxy/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: config.campaignName.trim() || `Campaign ${new Date().toLocaleDateString()}`,
                    status: "active",
                    type: "standard",
                    audience: config.audienceSource,
                    aiConfig: {
                        executionMode: config.executionMode,
                        context: config.customMessage.trim(),
                        tone: config.tone,
                        voice: config.voice,
                        formulation: config.formulation,
                        goal: "Outreach"
                    },
                    targetCount: 0
                })
            });

            if (!response.ok) {
                throw new Error("Failed to create campaign");
            }

            const data = await response.json();
            const campaignId = data?.data?.id as string | undefined;
            if (!campaignId) {
                throw new Error("Campaign created but response was missing an id");
            }

            if (campaignId && config.variantSubject?.trim() && config.variantBody?.trim()) {
                const variantsRes = await fetch(`/api/proxy/campaigns/${campaignId}/variants`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify([
                        {
                            subject: config.variantSubject.trim(),
                            body: config.variantBody.trim(),
                            weight: 100,
                        },
                    ]),
                });

                if (!variantsRes.ok) {
                    toast.warning("Campaign created, but the draft variant could not be attached.");
                }
            }

            toast.success("Campaign created. Opening details...");
            localStorage.removeItem("campaign_wizard_draft");
            onClose();
            router.push(`/campaigns/${campaignId}`);
        } catch (error) {
            toast.error("Failed to launch campaign");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <GlassCard className="relative m-0 flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden border-2 border-white/10 p-0">
                <div className="space-y-4 border-b border-white/10 bg-black/20 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                                <LayoutTemplate className="h-5 w-5 text-blue-400" />
                                Campaign launch plan
                            </h2>
                            <p className="max-w-2xl text-sm text-gray-400">
                                Build a campaign in five clear steps. Every choice below updates the launch summary before anything is created.
                            </p>
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Draft saves automatically while you work
                            </div>
                        </div>

                        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 lg:max-w-sm">
                            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500">
                                <span>Step {currentStepIndex + 1} of {WIZARD_STEPS.length}</span>
                                <span>{progress}% complete</span>
                            </div>
                            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-sm font-semibold text-white">{activeStep.title}</p>
                            <p className="mt-1 text-sm text-gray-400">{activeStep.helper}</p>
                        </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-5">
                        {WIZARD_STEPS.map((wizardStep, index) => {
                            const Icon = wizardStep.icon;
                            const isActive = wizardStep.id === step;
                            const isComplete = index < currentStepIndex;

                            return (
                                <div
                                    key={wizardStep.id}
                                    className={`rounded-2xl border px-4 py-3 transition-all ${
                                        isActive
                                            ? "border-blue-500/40 bg-blue-500/15 text-white"
                                            : isComplete
                                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                                                : "border-white/10 bg-white/[0.03] text-gray-500"
                                    }`}
                                >
                                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                                        <Icon className="h-3.5 w-3.5" />
                                        <span>{wizardStep.label}</span>
                                    </div>
                                    <p className="text-sm font-medium">{wizardStep.title}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{activeStep.label}</p>
                                <h3 className="text-3xl font-bold text-white">{activeStep.title}</h3>
                                <p className="max-w-3xl text-base text-gray-400">{activeStep.description}</p>
                            </div>

                            {step === "channel" && (
                                <ChannelSelector selected={config.channel} onSelect={(channel) => updateConfig({ channel })} />
                            )}
                            {step === "autonomy" && (
                                <AutonomySelector selected={config.executionMode} onSelect={(executionMode) => updateConfig({ executionMode })} />
                            )}
                            {step === "audience" && (
                                <AudienceSelector selected={config.audienceSource} onSelect={(audienceSource) => updateConfig({ audienceSource })} />
                            )}
                            {step === "messaging" && (
                                <MessagingEditor
                                    channel={config.channel}
                                    mode={config.executionMode}
                                    campaignName={config.campaignName}
                                    customMessage={config.customMessage}
                                    tone={config.tone}
                                    voice={config.voice}
                                    formulation={config.formulation}
                                    intelSignalId={config.intelSignalId}
                                    variantSubject={config.variantSubject}
                                    variantBody={config.variantBody}
                                    onChange={updateConfig}
                                />
                            )}
                            {step === "review" && <ReviewStep config={config} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 bg-black/20 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-medium text-white">
                            {step === "review"
                                ? "Launching now will create the campaign and take you to its detail page."
                                : nextDisabledReason || `Next: ${WIZARD_STEPS[currentStepIndex + 1]?.title ?? "Launch campaign"}`}
                        </p>
                        <p className="text-xs text-gray-500">
                            {step === "review"
                                ? "You can still edit targeting, approvals, and creative after launch."
                                : "You can move backward at any time without losing the draft."}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={currentStepIndex === 0 ? onClose : handleBack}
                            disabled={loading}
                            className="rounded-xl px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {currentStepIndex === 0 ? "Close" : "Back"}
                        </button>

                        <button
                            type="button"
                            onClick={step === "review" ? handleLaunch : handleNext}
                            disabled={loading || (step !== "review" && !canContinue)}
                            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 font-medium text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                step === "review"
                                    ? "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-500"
                                    : "bg-blue-600 shadow-blue-500/20 hover:bg-blue-500"
                            }`}
                        >
                            {loading ? "Launching..." : step === "review" ? "Launch campaign" : "Continue"}
                            {!loading && (step === "review" ? <Zap className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </button>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
function ReviewStep({ config }: { config: CampaignWizardConfig }) {
    const selectedChannel = CHANNEL_OPTIONS.find((option) => option.id === config.channel);
    const selectedMode = EXECUTION_MODES.find((mode) => mode.id === config.executionMode);
    const preview = buildPreview(config);

    return (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <SummaryCard label="Campaign name" value={config.campaignName} fallback="Untitled campaign" />
                    <SummaryCard label="Audience source" value={formatAudience(config.audienceSource)} />
                    <SummaryCard label="Primary channel" value={selectedChannel?.label ?? "Not selected"} />
                    <SummaryCard label="Approval mode" value={selectedMode?.label ?? "Not selected"} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Message brief</p>
                    <p className="mt-3 text-sm leading-7 text-gray-300">
                        {config.customMessage.trim() || "No campaign brief added yet."}
                    </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                        <ShieldCheck className="h-4 w-4" />
                        Safety summary
                    </div>
                    <p>
                        The Sovereign Firewall remains active in every mode. Message review, PII checks, and policy checks still run before sending.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">What happens next</p>
                    <div className="mt-4 space-y-3">
                        <ReviewStepItem number="1" title="Campaign is created" description="The campaign opens immediately so the team can continue with targeting and approvals." />
                        <ReviewStepItem number="2" title="Leads are connected" description="Use the selected audience source to attach or import leads into the campaign." />
                        <ReviewStepItem number="3" title="Execution rules stay visible" description="The selected approval mode stays visible on the campaign detail page for future edits." />
                    </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Launch preview</p>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="border-white/10 bg-white/5 text-gray-300">
                                Tone: {config.tone}
                            </Badge>
                            <Badge variant="secondary" className="border-white/10 bg-white/5 text-gray-300">
                                Voice: {config.voice}
                            </Badge>
                            <Badge variant="secondary" className="border-white/10 bg-white/5 text-gray-300">
                                Formulation: {config.formulation}
                            </Badge>
                        </div>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-4 text-sm leading-7 text-gray-300">{preview}</pre>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, fallback = "Not provided" }: { label: string; value?: string; fallback?: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</p>
            <p className="mt-2 text-base font-semibold text-white">{value?.trim() ? value : fallback}</p>
        </div>
    );
}

function ReviewStepItem({ number, title, description }: { number: string; title: string; description: string }) {
    return (
        <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-300">
                {number}
            </div>
            <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-gray-400">{description}</p>
            </div>
        </div>
    );
}
function ChannelSelector({ selected, onSelect }: { selected: ChannelType; onSelect: (channel: ChannelType) => void }) {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {CHANNEL_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = option.id === selected;

                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelect(option.id)}
                        className={`rounded-3xl border p-6 text-left transition-all duration-200 ${
                            isSelected ? option.selectedClassName : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className={`rounded-2xl bg-white/5 p-3 ${option.iconClassName}`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                        </div>
                        <h4 className="mt-5 text-xl font-semibold text-white">{option.label}</h4>
                        <p className="mt-2 text-sm text-gray-300">{option.desc}</p>
                        <p className="mt-4 text-sm text-gray-500">{option.detail}</p>
                    </button>
                );
            })}
        </div>
    );
}

function AutonomySelector({ selected, onSelect }: { selected: ExecutionMode; onSelect: (mode: ExecutionMode) => void }) {
    return (
        <div className="space-y-4">
            {EXECUTION_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = mode.id === selected;

                return (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSelect(mode.id)}
                        className={`flex w-full items-start gap-5 rounded-3xl border p-6 text-left transition-all ${
                            isSelected ? "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                    >
                        <div className={`rounded-2xl bg-white/5 p-3 ${mode.iconClassName}`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xl font-semibold text-white">{mode.label}</h4>
                                {mode.badge && <Badge variant="secondary">{mode.badge}</Badge>}
                            </div>
                            <p className="mt-2 text-sm text-gray-300">{mode.desc}</p>
                            <p className="mt-3 text-sm text-gray-500">{mode.detail}</p>
                        </div>
                        <div className={`mt-1 h-5 w-5 rounded-full border-2 ${isSelected ? "border-blue-400 bg-blue-400" : "border-gray-600"}`} />
                    </button>
                );
            })}

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                The firewall, policy checks, and message review trace remain active in every execution mode.
            </div>
        </div>
    );
}

function AudienceSelector({ selected, onSelect }: { selected: AudienceSource; onSelect: (source: AudienceSource) => void }) {
    const selectedOption = AUDIENCE_OPTIONS.find((option) => option.id === selected);

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
                {AUDIENCE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = option.id === selected;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.id)}
                            className={`rounded-3xl border p-6 text-left transition-all ${
                                isSelected ? option.selectedClassName : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className={`rounded-2xl bg-white/5 p-3 ${option.iconClassName}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                            </div>
                            <h4 className="mt-5 text-xl font-semibold text-white">{option.label}</h4>
                            <p className="mt-2 text-sm text-gray-300">{option.desc}</p>
                            <p className="mt-4 text-sm text-gray-500">{option.detail}</p>
                        </button>
                    );
                })}
            </div>

            <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Selected source</p>
                <h4 className="mt-2 text-xl font-semibold text-white">{selectedOption?.label ?? "Choose a source"}</h4>
                <p className="mt-2 text-sm text-gray-400">
                    {selectedOption?.detail ?? "Select the lead source that matches how this campaign should begin."}
                </p>
                <p className="mt-4 text-sm text-gray-500">
                    After launch, you can still attach a CSV, enrich contacts, or adjust the audience before messages send.
                </p>
            </div>
        </div>
    );
}
function MessagingEditor({
    channel,
    mode,
    campaignName,
    customMessage,
    tone,
    voice,
    formulation,
    intelSignalId,
    variantSubject,
    variantBody,
    onChange,
}: {
    channel: ChannelType;
    mode: ExecutionMode;
    campaignName: string;
    customMessage: string;
    tone: ToneOption;
    voice: VoiceOption;
    formulation: FormulationOption;
    intelSignalId: string;
    variantSubject: string;
    variantBody: string;
    onChange: (updates: Partial<CampaignWizardConfig>) => void;
}) {
    const [signals, setSignals] = useState<IntelSignal[]>([]);
    const [intelLoading, setIntelLoading] = useState(false);
    const [intelError, setIntelError] = useState<string | null>(null);
    const [generatingCopy, setGeneratingCopy] = useState(false);
    const [unlockingIntel, setUnlockingIntel] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIntelLoading(true);
            try {
                const res = await fetch("/api/proxy/intel/summary", { cache: "no-store" });
                if (!res.ok) {
                    throw new Error("Failed to load Intel feed");
                }
                const json = await res.json();
                const recentSignals = Array.isArray(json?.recentSignals) ? (json.recentSignals as IntelSignal[]) : [];
                if (!cancelled) {
                    setSignals(recentSignals);
                    setIntelError(null);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setIntelError(err.message || "Failed to load Intel feed");
                }
            } finally {
                if (!cancelled) {
                    setIntelLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const preview = buildPreview({
        ...DEFAULT_CONFIG,
        channel,
        executionMode: mode,
        campaignName,
        customMessage,
        tone,
        voice,
        formulation,
        audienceSource: "csv"
    });

    const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        onChange({ [name]: value } as Partial<CampaignWizardConfig>);
    };

    const selectedSignal = intelSignalId ? signals.find((s) => s.id === intelSignalId) : undefined;
    const canGenerateEmailCopy = channel === "email" || channel === "omnichannel";

    const handleInsertIntelBrief = () => {
        if (!selectedSignal) return;

        const brief = [
            `Intel capsule: ${selectedSignal.companyName} (${selectedSignal.buyingStage}, ${selectedSignal.intentScore}/100 intent)`,
            selectedSignal.whyNow ? `Why now: ${selectedSignal.whyNow}` : "",
            selectedSignal.whatTheyNeed ? `Need: ${selectedSignal.whatTheyNeed}` : "",
            selectedSignal.recommendedAction ? `Suggested angle: ${selectedSignal.recommendedAction}` : "",
            "",
            "Write outreach that references this signal without over-claiming. Keep it concrete, short, and ask for a specific next step.",
        ]
            .filter(Boolean)
            .join("\n");

        onChange({ customMessage: brief });
        toast.success("Intel capsule added to campaign brief.");
    };

    const handleGenerateCopy = async () => {
        if (!selectedSignal) return;
        if (!canGenerateEmailCopy) {
            toast.error("Email copy generation is available only for Email or Omnichannel campaigns.");
            return;
        }

        setGeneratingCopy(true);
        try {
            const nodeAInput = {
                prospect_name: "{firstName}",
                prospect_title: "{title}",
                prospect_company: selectedSignal.companyName,
                pain_context: selectedSignal.whatTheyNeed || selectedSignal.whyNow || "Operational need detected from buyer-intent signal",
                outreach_timing: `Signal received ${new Date(selectedSignal.receivedAt).toLocaleDateString()}`,
                avoid_topics: [],
                hypothesis: selectedSignal.recommendedAction || "Offer a fast, relevant next step tied to the detected intent.",
                signal_type: "Netjana Buyer Intent",
                extracted_signal: selectedSignal.whyNow || selectedSignal.whatTheyNeed || "High-intent buyer signal detected",
                sender_name: "[Your Name]",
                sender_email: "you@company.com",
                tone,
                voice,
                formulation,
                greeting_style: "first_name",
                sign_off: "Best",
                cta_style: "short_meeting",
            };

            const res = await fetch("/api/proxy/email/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ node: "A", input: nodeAInput }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to generate draft copy");
            }

            const json = await res.json();
            const subject = json?.data?.subject || "";
            const body = json?.data?.body || "";

            onChange({ variantSubject: subject, variantBody: body });
            toast.success("Draft email copy generated. Edit it before launch.");
        } catch (err: any) {
            toast.error(err.message || "Failed to generate copy");
        } finally {
            setGeneratingCopy(false);
        }
    };

    const handleUnlockFullIntel = async () => {
        if (!selectedSignal) return;
        setUnlockingIntel(true);
        try {
            const res = await fetch("/api/proxy/intel/detail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signalId: selectedSignal.id }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 403 && json?.code === "UPGRADE_REQUIRED") {
                    throw new Error("Full Intel reports require a top-tier plan.");
                }
                throw new Error(json?.error || "Failed to unlock full Intel report");
            }

            const lead = json?.lead || {};
            const whyNow = String(lead.card_why_now || "").trim();
            const need = String(lead.card_what_they_need || "").trim();
            const action = String(lead.card_do_this || "").trim();

            const fullIntelBlock = [
                `Intel report: ${selectedSignal.companyName}`,
                `Buying stage: ${selectedSignal.buyingStage} • Intent: ${selectedSignal.intentScore}/100`,
                whyNow ? `Why now: ${whyNow}` : "",
                need ? `What they need: ${need}` : "",
                action ? `Suggested action: ${action}` : "",
                "",
                "Use this intel as context. Do not over-claim; keep the outreach grounded and specific.",
            ]
                .filter(Boolean)
                .join("\n");

            setSignals((current) =>
                current.map((s) =>
                    s.id === selectedSignal.id
                        ? {
                              ...s,
                              whyNow: whyNow || s.whyNow,
                              whatTheyNeed: need || s.whatTheyNeed,
                              recommendedAction: action || s.recommendedAction,
                          }
                        : s
                )
            );

            toast.success("Full Intel report unlocked for this signal.");

            const apply = window.confirm(
                "Full Intel report unlocked.\n\nAdd the long-format intel details into the campaign brief for more customized content?"
            );
            if (apply) {
                const mergedBrief = customMessage.trim()
                    ? `${customMessage.trim()}\n\n---\n\n${fullIntelBlock}`
                    : fullIntelBlock;
                onChange({ customMessage: mergedBrief });
                toast.success("Full Intel report added to campaign brief.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to unlock full Intel");
        } finally {
            setUnlockingIntel(false);
        }
    };

    return (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-200">Netjana Intel capsule (optional)</p>
                            <p className="mt-1 text-sm text-gray-500">
                                Pick a buyer-intent signal as a pre-launch intelligence unit. Optionally convert it into editable email copy.
                            </p>
                        </div>
                        {intelLoading && <Badge variant="secondary">Loading…</Badge>}
                    </div>

                    {intelError && <p className="mt-3 text-sm text-red-300">{intelError}</p>}

                    {!intelLoading && !intelError && signals.length === 0 && (
                        <p className="mt-3 text-sm text-gray-400">No signals received yet.</p>
                    )}

                    {signals.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {signals.slice(0, 4).map((signal) => (
                                <IntelCapsule
                                    key={signal.id}
                                    signal={signal}
                                    selected={signal.id === intelSignalId}
                                    onSelect={(id) => onChange({ intelSignalId: id })}
                                />
                            ))}
                        </div>
                    )}

                    {selectedSignal && (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-gray-400">
                                Selected: <span className="font-medium text-white">{selectedSignal.companyName}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleUnlockFullIntel}
                                    disabled={unlockingIntel}
                                    className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {unlockingIntel ? "Unlocking…" : "Unlock full report"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInsertIntelBrief}
                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                                >
                                    Insert into brief
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerateCopy}
                                    disabled={!canGenerateEmailCopy || generatingCopy}
                                    className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {generatingCopy ? "Generating…" : "Generate email copy"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onChange({ intelSignalId: "" })}
                                    className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <label className="block text-sm font-medium text-gray-200" htmlFor="campaignName">
                        Campaign name
                    </label>
                    <input
                        id="campaignName"
                        name="campaignName"
                        value={campaignName}
                        onChange={handleFieldChange}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
                        placeholder="Q2 cloud efficiency outreach"
                    />
                    <p className="mt-2 text-sm text-gray-500">Use a name the team can recognize later in reports, approvals, and handoffs.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <label className="block text-sm font-medium text-gray-200" htmlFor="customMessage">
                        Campaign brief
                    </label>
                    <textarea
                        id="customMessage"
                        name="customMessage"
                        value={customMessage}
                        onChange={handleFieldChange}
                        className="mt-2 min-h-[180px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
                        placeholder="Explain the offer, the problem you solve, and the CTA the team should expect in the first message."
                    />
                    <p className="mt-2 text-sm text-gray-500">Write this the way you would brief an SDR: what to say, who it is for, and what response you want.</p>
                </div>

                {(variantSubject?.trim() || variantBody?.trim()) && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">Draft copy (Campaign Variant)</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    This will be saved as the initial campaign variant when you launch.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onChange({ variantSubject: "", variantBody: "" })}
                                className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
                            >
                                Remove draft
                            </button>
                        </div>

                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-200" htmlFor="variantSubject">
                                    Subject
                                </label>
                                <input
                                    id="variantSubject"
                                    name="variantSubject"
                                    value={variantSubject || ""}
                                    onChange={handleFieldChange}
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-200" htmlFor="variantBody">
                                    Body
                                </label>
                                <textarea
                                    id="variantBody"
                                    name="variantBody"
                                    value={variantBody || ""}
                                    onChange={handleFieldChange}
                                    className="mt-2 min-h-[180px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-medium text-gray-200">Tone</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {(["Professional", "Friendly", "Consultative", "Direct"] as ToneOption[]).map((toneOption) => (
                            <button
                                key={toneOption}
                                type="button"
                                onClick={() => onChange({ tone: toneOption })}
                                className={`rounded-full border px-4 py-2 text-sm transition-all ${
                                    tone === toneOption
                                        ? "border-blue-500/40 bg-blue-500/15 text-white"
                                        : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/10"
                                }`}
                            >
                                {toneOption}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <label className="block text-sm font-medium text-gray-200" htmlFor="campaignVoice">
                        Voice persona
                    </label>
                    <select
                        id="campaignVoice"
                        name="voice"
                        value={voice}
                        onChange={handleFieldChange}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
                    >
                        {(["Founder", "Operator", "Advisor", "Peer", "Analyst"] as VoiceOption[]).map((voiceOption) => (
                            <option key={voiceOption} value={voiceOption}>{voiceOption}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-sm text-gray-500">Defines the persona behind the outreach, independent of the tone selection.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <label className="block text-sm font-medium text-gray-200" htmlFor="campaignFormulation">
                        Formulation style
                    </label>
                    <select
                        id="campaignFormulation"
                        name="formulation"
                        value={formulation}
                        onChange={handleFieldChange}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
                    >
                        {(["Problem-Solution", "Proof-first", "Narrative", "Executive Brief", "Bullet-light"] as FormulationOption[]).map((formulationOption) => (
                            <option key={formulationOption} value={formulationOption}>{formulationOption}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-sm text-gray-500">Controls the structure used to present the signal, hypothesis, and CTA.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-white">Sequence preview</p>
                            <p className="mt-1 text-sm text-gray-500">Based on the selected {channel} launch path.</p>
                        </div>
                        {mode === "saferun" && <Badge variant="secondary">Human review before send</Badge>}
                    </div>
                    <div className="mt-4 space-y-3">
                        {CHANNEL_SEQUENCE[channel].map((sequenceStep, index) => (
                            <div key={sequenceStep} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-300">
                                    {index + 1}
                                </div>
                                <span className="text-sm text-gray-200">{sequenceStep}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-white/10 bg-black/30">
                <div className="border-b border-white/10 p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Live preview</p>
                            <p className="mt-1 text-sm text-gray-300">This preview updates from the campaign brief as you type.</p>
                        </div>
                        <Badge variant="secondary">{tone}</Badge>
                    </div>
                </div>

                <div className="flex-1 p-5">
                    <pre className="min-h-[320px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-gray-300">{preview}</pre>
                </div>

                <div className="border-t border-white/10 p-5 text-sm text-gray-400">
                    <div className="flex items-center justify-between gap-4">
                        <span>{preview.length} characters</span>
                        <span>{Math.max(1, Math.round(preview.split(/\s+/).filter(Boolean).length / 160))} min read</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                        {mode === "saferun"
                            ? "SafeRun keeps this editable and routes every message through review."
                            : "Guided modes use this brief as the instruction source for generated drafts."}
                    </p>
                </div>
            </div>
        </div>
    );
}
