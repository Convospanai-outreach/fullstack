"use client";

import { useState, useEffect } from "react";
import {
    LayoutTemplate,
    Mail,
    Linkedin,
    Share2,
    ShieldCheck,
    Zap,
    Bot,
    Users,
    Upload,
    Search,
    PenTool,
    ChevronRight,
    CheckCircle2
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

export type WizardStep = "channel" | "autonomy" | "audience" | "messaging" | "review";

export type ChannelType = "linkedin" | "email" | "omnichannel";
export type ExecutionMode = "saferun" | "hybrid" | "autonomous";

export default function StrategyWizard({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState<WizardStep>("channel");
    const [config, setConfig] = useState({
        channel: "linkedin" as ChannelType,
        executionMode: "saferun" as ExecutionMode,
        audienceSource: "",
        campaignName: "",
        customMessage: "",
    });

    const steps = [
        { id: "channel", label: "Channel", icon: Share2 },
        { id: "autonomy", label: "Autonomy", icon: ShieldCheck },
        { id: "audience", label: "Audience", icon: Users },
        { id: "messaging", label: "Messaging", icon: PenTool },
    ];

    // Resilience: Auto-save draft to localStorage
    useEffect(() => {
        const saved = localStorage.getItem("campaign_wizard_draft");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConfig(parsed);
                toast.info("Restored your previous draft");
            } catch (e) { console.error("Failed to restore draft", e); }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("campaign_wizard_draft", JSON.stringify(config));
    }, [config]);

    const handleNext = () => {
        const order: WizardStep[] = ["channel", "autonomy", "audience", "messaging", "review"];
        const currentIndex = order.indexOf(step);
        if (currentIndex < order.length - 1) {
            const next = order[currentIndex + 1];
            if (next) setStep(next);
        }
    };

    const handleBack = () => {
        const order: WizardStep[] = ["channel", "autonomy", "audience", "messaging", "review"];
        const currentIndex = order.indexOf(step);
        if (currentIndex > 0) {
            const prev = order[currentIndex - 1];
            if (prev) setStep(prev);
        }
    };

    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLaunch = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: config.campaignName || `Campaign ${new Date().toLocaleDateString()}`,
                    status: "active", // Immediate launch
                    type: "standard",
                    audience: config.audienceSource || "manual", // Store the source type
                    aiConfig: {
                        executionMode: config.executionMode,
                        context: config.customMessage, // Using custom message as context
                        tone: "Professional", // Could be dynamic if added to config state
                        goal: "Outreach"
                    },
                    targetCount: 0 // Will be updated when leads are added
                })
            });

            if (!res.ok) throw new Error("Failed to create campaign");

            const data = await res.json();
            toast.success("Campaign launched successfully!");
            localStorage.removeItem("campaign_wizard_draft");
            onClose();
            router.push(`/campaigns/${data.data.id}`);
        } catch (error) {
            toast.error("Failed to launch campaign");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border-2 border-white/10 m-0 p-0 relative">

                {/* Header / Progress */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-blue-400" />
                            Campaign Strategy Wizard
                        </h2>
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-gray-400">Design your outreach execution flow</p>
                            <span className="text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
                                Draft Saved
                            </span>
                        </div>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center gap-2">
                        {steps.map((s, idx) => (
                            <div key={s.id} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${step === s.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                    : steps.indexOf(s) < steps.findIndex(x => x.id === step)
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-white/5 text-gray-500 border border-white/5"
                                    }`}>
                                    <s.icon className="w-3 h-3" />
                                    {s.label}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className="w-4 h-px bg-white/10 mx-1" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {step === "channel" && (
                                <ChannelSelector
                                    selected={config.channel}
                                    onSelect={(c) => setConfig({ ...config, channel: c })}
                                />
                            )}
                            {step === "autonomy" && (
                                <AutonomySelector
                                    selected={config.executionMode}
                                    onSelect={(m) => setConfig({ ...config, executionMode: m })}
                                />
                            )}
                            {step === "audience" && (
                                <AudienceSelector />
                            )}
                            {step === "messaging" && (
                                <MessagingEditor mode={config.executionMode} />
                            )}
                            {step === "review" && (
                                <ReviewStep config={config} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
                    <button
                        onClick={step === "channel" ? onClose : handleBack}
                        className="text-sm text-gray-400 hover:text-white px-4 py-2 hover:bg-white/5 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        {step === "channel" ? "Cancel" : "Back"}
                    </button>

                    <button
                        onClick={step === "review" ? handleLaunch : handleNext}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium shadow-lg transition-all ${step === "review"
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                            } disabled:opacity-50`}
                    >
                        {loading ? "Launching..." : (step === "review" ? "Launch Campaign" : "Continue")}
                        {!loading && (step === "review" ? <Zap className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                    </button>
                </div>

            </GlassCard>
        </div>
    );
}

// --- Step Components ---

function ReviewStep({ config }: { config: any }) {
    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">Ready to Launch?</h3>
                <p className="text-gray-400">Review your campaign configuration below.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Channel</span>
                    <div className="font-bold text-white text-lg capitalize flex items-center gap-2">
                        {config.channel === 'linkedin' && <Linkedin className="w-4 h-4 text-blue-400" />}
                        {config.channel === 'email' && <Mail className="w-4 h-4 text-purple-400" />}
                        {config.channel}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Autonomy</span>
                    <div className="font-bold text-white text-lg capitalize flex items-center gap-2">
                        {config.executionMode === 'saferun' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        {config.executionMode === 'autonomous' && <Bot className="w-4 h-4 text-red-400" />}
                        {config.executionMode.replace('_', ' ')}
                    </div>
                </div>
            </div>

            <div className="p-6 rounded-xl bg-black/40 border border-white/10 space-y-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Target Audience</h4>
                        <p className="text-sm text-gray-400">Importing from CSV / 250 Leads</p>
                    </div>
                </div>

                <div className="w-full h-px bg-white/10" />

                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                        <PenTool className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Messaging Strategy</h4>
                        <p className="text-sm text-gray-400">
                            {config.executionMode === 'saferun' ? 'Manual Verification Required' : 'AI Assisted Drafting'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 text-sm text-emerald-200">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <p>
                    <strong>Safety Check Passed:</strong> Sovereign Firewall is active. PII detection will run on all {config.channel} messages before sending.
                </p>
            </div>
        </div>
    );
}

function ChannelSelector({ selected, onSelect }: { selected: ChannelType, onSelect: (c: ChannelType) => void }) {
    const options = [
        {
            id: "linkedin",
            label: "LinkedIn Professional",
            desc: "Network-first approach. Best for B2B relationship building.",
            icon: Linkedin,
            color: "text-blue-400",
            border: "group-hover:border-blue-500/50"
        },
        {
            id: "email",
            label: "Cold Email",
            desc: "High-volume outreach via your connected inboxes.",
            icon: Mail,
            color: "text-purple-400",
            border: "group-hover:border-purple-500/50"
        },
        {
            id: "omnichannel",
            label: "Omnichannel Mix",
            desc: "Adaptive sequence. Start on LinkedIn, fallback to Email.",
            icon: Share2,
            color: "text-emerald-400",
            border: "group-hover:border-emerald-500/50"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
                <h3 className="text-2xl font-bold text-white">Choose your Outreach Channel</h3>
                <p className="text-gray-400">Where should this campaign execute?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onSelect(opt.id as ChannelType)}
                        className={`relative p-6 rounded-2xl border text-left transition-all duration-300 group hover:bg-white/5 ${selected === opt.id
                            ? `bg-white/5 border-${opt.color.split("-")[1]}-500 ring-2 ring-${opt.color.split("-")[1]}-500/20`
                            : "border-white/10 hover:border-white/20"
                            }`}
                    >
                        <div className={`p-3 rounded-xl bg-white/5 w-fit mb-4 ${opt.color}`}>
                            <opt.icon className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">{opt.label}</h4>
                        <p className="text-sm text-gray-400">{opt.desc}</p>

                        {selected === opt.id && (
                            <div className="absolute top-4 right-4 text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

function AutonomySelector({ selected, onSelect }: { selected: ExecutionMode, onSelect: (m: ExecutionMode) => void }) {
    const modes = [
        {
            id: "saferun",
            label: "SafeRun™ Assisted",
            desc: "100% Human Verification. You review every message before it sends.",
            icon: ShieldCheck,
            color: "text-emerald-400",
            badge: "Recommended"
        },
        {
            id: "hybrid",
            label: "Hybrid Autonomy",
            desc: "Auto-pilot with safety brakes. Falls back to human review if AI confidence < 90%.",
            icon: Zap,
            color: "text-orange-400"
        },
        {
            id: "autonomous",
            label: "Fully Autonomous",
            desc: "Hands-free execution. AI handles finding, drafting, and sending.",
            icon: Bot,
            color: "text-red-400",
            badge: "Pro"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
                <h3 className="text-2xl font-bold text-white">Select Autonomy Level</h3>
                <p className="text-gray-400">How much control do you want over execution?</p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => onSelect(mode.id as ExecutionMode)}
                        className={`flex items-start gap-5 p-6 rounded-2xl border text-left transition-all hover:bg-white/5 ${selected === mode.id
                            ? "bg-white/5 border-blue-500/50 ring-1 ring-blue-500/20"
                            : "border-white/10 hover:border-white/20"
                            }`}
                    >
                        <div className={`p-3 rounded-xl bg-white/5 mt-1 ${mode.color}`}>
                            <mode.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-bold text-white">{mode.label}</h4>
                                {mode.badge && (
                                    <Badge variant="default" className="text-xs">{mode.badge}</Badge>
                                )}
                            </div>
                            <p className="text-sm text-gray-400">{mode.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-2 ${selected === mode.id ? "border-blue-500" : "border-gray-600"
                            }`}>
                            {selected === mode.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                        </div>
                    </button>
                ))}
            </div>

            {/* Disclaimer */}
            <div className="max-w-2xl mx-auto bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-sm text-blue-200/80">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <p>
                    Regardless of your choice, the <span className="font-bold text-blue-300">Sovereign Firewall</span> remains active, blocking PII leaks and checking compliance policies locally.
                </p>
            </div>
        </div>
    );
}

// --- Step 3: Audience ---

function AudienceSelector() {
    const [source, setSource] = useState<"csv" | "hunter" | "manual" | null>(null);

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
                <h3 className="text-2xl font-bold text-white">Select Audience Source</h3>
                <p className="text-gray-400">Who are we targeting today?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                    onClick={() => setSource("csv")}
                    className={`p-6 rounded-2xl border text-center hover:bg-white/5 transition-all ${source === "csv" ? "border-blue-500 bg-white/5" : "border-white/10"
                        }`}
                >
                    <Upload className="w-8 h-8 mx-auto mb-4 text-blue-400" />
                    <h4 className="font-bold text-white mb-2">Import CSV</h4>
                    <p className="text-xs text-gray-400">Upload a list of leads with LinkedIn URLs or Emails.</p>
                </button>

                <button
                    onClick={() => setSource("hunter")}
                    className={`p-6 rounded-2xl border text-center hover:bg-white/5 transition-all ${source === "hunter" ? "border-orange-500 bg-white/5" : "border-white/10"
                        }`}
                >
                    <Search className="w-8 h-8 mx-auto mb-4 text-orange-400" />
                    <h4 className="font-bold text-white mb-2">Hunter.io</h4>
                    <p className="text-xs text-gray-400">Find professional emails by company domain.</p>
                    <Badge variant="warning" className="mt-2 text-[10px] border-orange-500/30 text-orange-300">New Integration</Badge>
                </button>

                <button
                    onClick={() => setSource("manual")}
                    className={`p-6 rounded-2xl border text-center hover:bg-white/5 transition-all ${source === "manual" ? "border-purple-500 bg-white/5" : "border-white/10"
                        }`}
                >
                    <PenTool className="w-8 h-8 mx-auto mb-4 text-purple-400" />
                    <h4 className="font-bold text-white mb-2">Manual Entry</h4>
                    <p className="text-xs text-gray-400">Type or paste a list of prospects manually.</p>
                </button>
            </div>

            {/* Dynamic Content based on source */}
            <div className="min-h-[150px] flex items-center justify-center border border-dashed border-white/20 rounded-xl bg-black/20">
                {source === "csv" && (
                    <div className="text-center">
                        <Button variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" /> Select File
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">Target: 250 Leads</p>
                    </div>
                )}
                {source === "hunter" && (
                    <div className="w-full max-w-sm space-y-3 p-4">
                        <input type="text" placeholder="e.g. acme.com" className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white" />
                        <Button className="w-full bg-orange-600 hover:bg-orange-500">Find Emails</Button>
                    </div>
                )}
                {source === "manual" && (
                    <textarea
                        className="w-full h-[120px] bg-transparent border-none text-sm text-white p-4 focus:ring-0 resize-none"
                        placeholder="Paste LinkedIn URLs or Emails here (one per line)..."
                    />
                )}
                {!source && <p className="text-gray-500 text-sm">Select a source to begin</p>}
            </div>
        </div>
    );
}

// --- Step 4: Messaging ---

function MessagingEditor({ mode }: { mode: ExecutionMode }) {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <h3 className="text-2xl font-bold text-white">Craft your Message</h3>
                    <p className="text-gray-400 text-sm mt-1">
                        {mode === "saferun"
                            ? "You are in SafeRun™ Mode. You can customize every message."
                            : "AI will generate drafts based on this context."}
                    </p>
                </div>
                {mode === "saferun" && (
                    <Badge variant="success" className="gap-1">
                        <PenTool className="w-3 h-3" /> Human-Led Customization
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left: Configuration */}
                <div className="space-y-4 overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Campaign Goal / Context</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[100px]"
                            placeholder="e.g. We are offering a free audit of their cloud infrastructure..."
                            onChange={() => { /* Real implementation would update AI context */ }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Tone</label>
                        <div className="flex gap-2">
                            {["Professional", "Casual", "Urgent", "Friendly"].map(t => (
                                <button key={t} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <h4 className="font-bold text-white mb-2 text-sm">Sequence Steps</h4>
                        <div className="space-y-2">
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs border border-blue-500/30">1</div>
                                <span className="text-sm text-gray-300">Connection Request</span>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs border border-purple-500/30">2</div>
                                <span className="text-sm text-gray-300">Follow-up Email (2 days later)</span>
                            </div>
                        </div>
                        <Button variant="ghost" className="w-full mt-2 text-blue-400 text-xs">+ Add Step</Button>
                    </div>
                </div>

                {/* Right: Preview / Editor */}
                <div className="bg-black/40 rounded-xl border border-white/10 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-400">Preview: Lead #1 (Top Priority)</span>
                        <div className="flex gap-1">
                            {/* Strength Meter (Mock) */}
                            <div className="flex items-center gap-2 mr-2">
                                <span className="text-[10px] uppercase text-gray-500 font-bold">Message Strength</span>
                                <div className="flex gap-0.5">
                                    <div className="w-1.5 h-3 rounded-sm bg-emerald-500" />
                                    <div className="w-1.5 h-3 rounded-sm bg-emerald-500" />
                                    <div className="w-1.5 h-3 rounded-sm bg-emerald-500" />
                                    <div className="w-1.5 h-3 rounded-sm bg-gray-700" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        <div className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-gray-600" />
                            <div className="space-y-1">
                                <div className="h-3 w-24 bg-gray-700 rounded animate-pulse" />
                                <div className="h-2 w-16 bg-gray-800 rounded animate-pulse" />
                            </div>
                        </div>

                        {/* The Editable Message Area */}
                        <div className="relative group">
                            <textarea
                                className={`w-full bg-transparent text-sm text-gray-300 resize-none min-h-[200px] focus:outline-none ${mode === "saferun" ? "cursor-text" : "cursor-not-allowed opacity-70"
                                    }`}
                                readOnly={mode !== "saferun"}
                                defaultValue="Hi {firstName},&#10;&#10;I noticed you're leading engineering at {company}. Many leaders I talk to are struggling with cloud costs...&#10;&#10;Would you be open to a 15-min chat?&#10;&#10;Best,&#10;[Your Name]"
                            />

                            {mode !== "saferun" ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-medium text-white bg-black/80 px-3 py-1.5 rounded-full border border-white/20">
                                        Editing disabled in Autonomous Mode
                                    </span>
                                </div>
                            ) : (
                                <div className="absolute bottom-2 right-2">
                                    <button className="flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg text-xs border border-purple-500/20 transition-all">
                                        <Bot className="w-3 h-3" /> AI Improve
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-3 border-t border-white/10 bg-white/5 flex justify-between items-center text-xs text-gray-500">
                        <span>~450 characters</span>
                        <div className="flex items-center gap-2">
                            <span>Estimated Read Time: 30s</span>
                            {/* Suggestion Badge */}
                            <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                                Tip: Keep it under 50 words
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



