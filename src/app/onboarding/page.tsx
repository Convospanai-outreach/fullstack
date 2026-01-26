"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        role: "",
        companyName: "",
        companySize: "",
        goals: [] as string[]
    });

    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            // Submit and redirect
            router.push("/dashboard");
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const toggleGoal = (goal: string) => {
        setFormData(prev => ({
            ...prev,
            goals: prev.goals.includes(goal)
                ? prev.goals.filter(g => g !== goal)
                : [...prev.goals, goal]
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <GlassCard className="max-w-2xl w-full p-8 space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold gradient-text">Welcome to ConvoSpan</h1>
                    <p className="text-gray-400">Let's get you set up in just a few steps.</p>
                </div>

                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full ${step >= i ? "bg-blue-500" : "bg-gray-700"}`} />
                    ))}
                </div>

                {step === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-white">What is your role?</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {["Founder", "Sales Manager", "Recruiter", "Marketer"].map(role => (
                                <button
                                    key={role}
                                    onClick={() => setFormData({ ...formData, role })}
                                    className={`p-4 rounded-xl border transition text-left ${formData.role === role
                                        ? "border-blue-500 bg-blue-500/10 text-white"
                                        : "border-white/10 hover:border-white/30 text-gray-400"
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-white">Tell us about your company</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Company Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                    placeholder="Acme Inc."
                                    value={formData.companyName}
                                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Company Size</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                    value={formData.companySize}
                                    onChange={e => setFormData({ ...formData, companySize: e.target.value })}
                                >
                                    <option value="">Select size...</option>
                                    <option value="1-10">1-10 employees</option>
                                    <option value="11-50">11-50 employees</option>
                                    <option value="51-200">51-200 employees</option>
                                    <option value="200+">200+ employees</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-white">What are your goals?</h2>
                        <div className="space-y-3">
                            {[
                                "Automate LinkedIn Outreach",
                                "Manage Inbound Leads",
                                "Scale Email Campaigns",
                                "Enrich Lead Data"
                            ].map(goal => (
                                <div
                                    key={goal}
                                    onClick={() => toggleGoal(goal)}
                                    className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition ${formData.goals.includes(goal)
                                        ? "border-blue-500 bg-blue-500/10 text-white"
                                        : "border-white/10 hover:border-white/30 text-gray-400"
                                        }`}
                                >
                                    <span>{goal}</span>
                                    {formData.goals.includes(goal) && (
                                        <span className="text-blue-500">✓</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-between pt-6 border-t border-white/10">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1}
                        className={step === 1 ? "invisible" : ""}
                    >
                        Back
                    </Button>
                    <Button variant="primary" onClick={handleNext}>
                        {step === 3 ? "Get Started" : "Next"}
                    </Button>
                </div>
            </GlassCard>
        </div>
    );
}
