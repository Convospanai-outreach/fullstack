"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Target, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type RoleOption = "Founder" | "Sales Manager" | "Recruiter" | "Marketer";

type OnboardingData = {
    role: RoleOption | "";
    companyName: string;
    companySize: string;
    goals: string[];
};

const stepMeta = [
    {
        id: 1,
        label: "Role",
        title: "Tell us how you use the workspace",
        description: "We use this to shape the recommended dashboard view and setup path."
    },
    {
        id: 2,
        label: "Company",
        title: "Add a little company context",
        description: "This keeps the next setup steps grounded in how your team operates."
    },
    {
        id: 3,
        label: "Goals",
        title: "Choose the outcomes you care about first",
        description: "Your setup flow should match the campaign goals you want to activate early."
    }
];

const roleOptions: RoleOption[] = ["Founder", "Sales Manager", "Recruiter", "Marketer"];
const goalOptions = [
    "Launch compliant email outreach",
    "Add LinkedIn outreach via Chrome extension (optional)",
    "Manage inbound leads",
    "Scale email campaigns",
    "Enrich lead data"
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<OnboardingData>({
        role: "",
        companyName: "",
        companySize: "",
        goals: []
    });

    const activeStep = stepMeta[step - 1] ?? stepMeta[0]!;
    const progress = Math.round((step / stepMeta.length) * 100);

    const nextDisabledReason = useMemo(() => {
        if (step === 1 && !formData.role) {
            return "Choose the role that best matches how you will use the workspace.";
        }
        if (step === 2) {
            if (!formData.companyName.trim()) {
                return "Add your company name before moving on.";
            }
            if (!formData.companySize) {
                return "Choose a company size before moving on.";
            }
        }
        if (step === 3 && formData.goals.length === 0) {
            return "Pick at least one goal so setup can point you to the right next actions.";
        }
        return "";
    }, [formData, step]);

    const toggleGoal = (goal: string) => {
        setFormData((current) => ({
            ...current,
            goals: current.goals.includes(goal)
                ? current.goals.filter((item) => item !== goal)
                : [...current.goals, goal]
        }));
    };

    const handleNext = () => {
        if (nextDisabledReason) {
            toast.error(nextDisabledReason);
            return;
        }

        if (step < stepMeta.length) {
            setStep((current) => current + 1);
            return;
        }

        toast.success("Onboarding complete. Opening guided setup...");
        router.push("/setup");
    };

    const handleBack = () => {
        if (step > 1) {
            setStep((current) => current - 1);
        }
    };

    return (
        <main className="min-h-screen p-4">
            <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center py-10">
                <GlassCard className="w-full p-8">
                    <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr]">
                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Step {step} of {stepMeta.length}</p>
                                <h1 className="mt-3 text-3xl font-bold text-white">Welcome to CraftMyFunnel</h1>
                                <p className="mt-2 text-gray-400">This takes about a minute. After this, we move you into the deeper setup checklist.</p>
                            </div>

                            <div>
                                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-gray-500">
                                    <span>{activeStep.label}</span>
                                    <span>{progress}% complete</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <h2 className="text-2xl font-semibold text-white">{activeStep.title}</h2>
                                <p className="mt-2 text-sm text-gray-400">{activeStep.description}</p>
                            </div>

                            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    What you unlock next
                                </div>
                                <p className="mt-3">You will continue to a setup flow for email, AI keys, lead import, billing, and launch controls.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {step === 1 && (
                                <div className="space-y-4">
                                    {roleOptions.map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role })}
                                            className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
                                                formData.role === role
                                                    ? "border-cyan-500/40 bg-cyan-500/10 text-white"
                                                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:bg-white/[0.05]"
                                            }`}
                                        >
                                            <div className="rounded-2xl bg-white/5 p-3 text-cyan-300">
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{role}</p>
                                                <p className="mt-1 text-sm text-gray-400">This sets the initial lens for dashboard guidance and recommended actions.</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-300">Company name</label>
                                        <input
                                            type="text"
                                            value={formData.companyName}
                                            onChange={(event) => setFormData({ ...formData, companyName: event.target.value })}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none transition focus:border-cyan-500"
                                            placeholder="Acme Inc."
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-300">Company size</label>
                                        <select
                                            value={formData.companySize}
                                            onChange={(event) => setFormData({ ...formData, companySize: event.target.value })}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none transition focus:border-cyan-500"
                                        >
                                            <option value="">Select size...</option>
                                            <option value="1-10">1-10 employees</option>
                                            <option value="11-50">11-50 employees</option>
                                            <option value="51-200">51-200 employees</option>
                                            <option value="200+">200+ employees</option>
                                        </select>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                                        <div className="flex items-center gap-2 text-white">
                                            <Building2 className="h-4 w-4 text-cyan-300" />
                                            Why this matters
                                        </div>
                                        <p className="mt-2">This context helps shape the recommended setup path and campaign defaults shown next.</p>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    {goalOptions.map((goal) => (
                                        <button
                                            key={goal}
                                            type="button"
                                            onClick={() => toggleGoal(goal)}
                                            className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-5 text-left transition-all ${
                                                formData.goals.includes(goal)
                                                    ? "border-cyan-500/40 bg-cyan-500/10 text-white"
                                                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:bg-white/[0.05]"
                                            }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-2xl bg-white/5 p-3 text-cyan-300">
                                                    <Target className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{goal}</p>
                                                    <p className="mt-1 text-sm text-gray-400">This goal will influence which launch path feels most relevant in setup.</p>
                                                </div>
                                            </div>
                                            {formData.goals.includes(goal) && <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-400" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t border-white/10 pt-6">
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={step === 1}
                                    className={step === 1 ? "invisible" : ""}
                                >
                                    Back
                                </Button>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">{nextDisabledReason || (step === stepMeta.length ? "Next: open guided setup" : "Everything needed for this step is complete.")}</p>
                                    <Button variant="default" onClick={handleNext} className="mt-2">
                                        {step === stepMeta.length ? "Continue to setup" : "Next"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </main>
    );
}
