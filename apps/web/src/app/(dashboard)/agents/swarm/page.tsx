"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Play, RefreshCw, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_ROLES = [
    "User Simulator",
    "Admin Operator",
    "Technical Auditor",
    "Debugger",
    "DevOps Specialist",
    "Market Researcher",
    "UI/UX Frontend",
    "Product Head",
    "CEO Advisor",
    "CTO Architect",
    "Frontend Integrator",
    "Test Executor",
    "Robustness Reviewer",
    "Adversarial Red Team",
    "Critique Partner",
    "Audit Sentinel",
];

const USER_BEHAVIOR_ROLES = [
    "First-time Founder User",
    "Sales Operator User",
    "RevOps Manager User",
    "Workspace Admin User",
    "UI/UX Frontend",
    "Adversarial Red Team",
    "Test Executor",
    "Product Head",
];

type SwarmType = "GENERAL_REVIEW" | "USER_BEHAVIOR";

type BehaviorReport = {
    persona?: string;
    scenario?: string;
    journey?: string[];
    frictionScore?: number;
    confidence?: string;
    findings?: Array<{
        scenario?: string;
        severity?: string;
        friction?: string;
        recommendation?: string;
    }>;
    nextBestTests?: string[];
};

type SwarmTask = {
    taskId: string;
    role: string;
    status: string;
    updatedAt: string;
    agentId: string;
    agentName: string;
    agentStatus: string;
    summary: string | null;
    swarmType?: string;
    behaviorReport?: BehaviorReport | null;
    failureReason: string | null;
};

type SwarmStatusResponse = {
    ok: boolean;
    swarmId: string;
    counts: {
        total: number;
        pending: number;
        running: number;
        completed: number;
        failed: number;
        paused?: number;
    };
    tasks: SwarmTask[];
};

function statusPillClass(status: string) {
    const normalized = status.toUpperCase();
    if (normalized === "COMPLETED") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    if (normalized === "RUNNING") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
    if (normalized === "FAILED") return "bg-red-500/15 text-red-300 border-red-400/30";
    if (normalized === "PAUSED") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
    return "bg-slate-500/15 text-slate-300 border-slate-400/30";
}

export default function AgentSwarmPage() {
    const [goal, setGoal] = useState(
        "Audit and improve campaign flow, onboarding clarity, LinkedIn extension integration, and launch readiness."
    );
    const [swarmType, setSwarmType] = useState<SwarmType>("GENERAL_REVIEW");
    const [selectedRoles, setSelectedRoles] = useState<string[]>(DEFAULT_ROLES);
    const [swarmId, setSwarmId] = useState<string>("");
    const [status, setStatus] = useState<SwarmStatusResponse | null>(null);
    const [isLaunching, setIsLaunching] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string>("");

    const activeRoles = swarmType === "USER_BEHAVIOR" ? USER_BEHAVIOR_ROLES : DEFAULT_ROLES;
    const allSelected = selectedRoles.length === activeRoles.length;
    const completionPercent = useMemo(() => {
        if (!status?.counts?.total) return 0;
        return Math.round((status.counts.completed / status.counts.total) * 100);
    }, [status]);

    async function refreshStatus(targetSwarmId: string, silent = false) {
        if (!targetSwarmId) return;
        if (!silent) {
            setIsRefreshing(true);
        }

        try {
            const res = await fetch(`${process.env["NEXT_PUBLIC_API_URL"]}/orchestrator/swarm/status?swarmId=${targetSwarmId}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to fetch swarm status");
            }
            setStatus(data);
            setError("");
        } catch (e: any) {
            setError(e?.message || "Unable to refresh swarm status");
        } finally {
            if (!silent) {
                setIsRefreshing(false);
            }
        }
    }

    async function launchSwarm() {
        if (selectedRoles.length === 0) {
            setError("Select at least one role before launch.");
            return;
        }

        setIsLaunching(true);
        setError("");
        setStatus(null);
        try {
            const res = await fetch(`${process.env["NEXT_PUBLIC_API_URL"]}/orchestrator/swarm/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal,
                    roles: selectedRoles,
                    swarmType
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to launch swarm");
            }

            setSwarmId(data.swarmId);
            await refreshStatus(data.swarmId);
        } catch (e: any) {
            setError(e?.message || "Unable to launch swarm");
        } finally {
            setIsLaunching(false);
        }
    }

    useEffect(() => {
        if (!swarmId) return;

        const handle = setInterval(() => {
            refreshStatus(swarmId, true).catch(() => {
                // Poll failure is surfaced on explicit refresh; keep interval resilient.
            });
        }, 3000);

        return () => clearInterval(handle);
    }, [swarmId]);

    function setMode(nextType: SwarmType) {
        setSwarmType(nextType);
        if (nextType === "USER_BEHAVIOR") {
            setGoal("Simulate real user behavior across signup, onboarding, lead capture, email outreach, LinkedIn follow-up, and funnel status updates. Report friction, stuck points, and suggested fixes without changing user data.");
            setSelectedRoles(USER_BEHAVIOR_ROLES);
            return;
        }

        setGoal("Audit and improve campaign flow, onboarding clarity, LinkedIn extension integration, and launch readiness.");
        setSelectedRoles(DEFAULT_ROLES);
    }

    return (
        <div className="space-y-8">
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-slate-900/80 to-emerald-500/10 p-6 lg:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                            <Sparkles className="h-3.5 w-3.5" />
                            Parallel Subagent System
                        </p>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                            Launch all specialist agents at once
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                            Run role-based checks simultaneously across product, technical, UX, and campaign layers.
                            Use <strong className="text-white">User Behavior Test</strong> mode to simulate signup,
                            onboarding, lead capture, email, LinkedIn, and funnel update behavior.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/agents/builder">
                            <Button variant="outline" className="gap-2">
                                <Bot className="h-4 w-4" />
                                Open Builder
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-cyan-300" />
                        <h2 className="text-xl font-semibold text-white">Execution Goal</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                        Set one shared objective. Every selected role runs its own specialist pass in parallel.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                            { value: "GENERAL_REVIEW" as const, label: "General Review", text: "Product, engineering, readiness, and launch checks." },
                            { value: "USER_BEHAVIOR" as const, label: "User Behavior Test", text: "Persona journeys, friction scoring, and stuck-point suggestions." },
                        ].map((option) => {
                            const active = swarmType === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setMode(option.value)}
                                    className={`rounded-2xl border p-4 text-left transition ${active
                                        ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                                        : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20"
                                        }`}
                                >
                                    <span className="block text-sm font-semibold text-white">{option.label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-400">{option.text}</span>
                                </button>
                            );
                        })}
                    </div>
                    <textarea
                        value={goal}
                        onChange={(event) => setGoal(event.target.value)}
                        rows={5}
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                        placeholder="Describe exactly what the subagent swarm should inspect and improve."
                    />

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedRoles(allSelected ? [] : activeRoles)}
                        >
                            {allSelected ? "Clear all roles" : "Select all roles"}
                        </Button>
                        <Button
                            type="button"
                            onClick={launchSwarm}
                            className="gap-2"
                            disabled={isLaunching}
                        >
                            {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            {isLaunching ? "Launching..." : "Launch Parallel Swarm"}
                        </Button>
                    </div>

                    {error && (
                        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                            {error}
                        </p>
                    )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <h2 className="text-xl font-semibold text-white">Specialist Roles</h2>
                    <p className="mt-2 text-sm text-slate-400">Choose the roles you want in this run.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {activeRoles.map((role) => {
                            const checked = selectedRoles.includes(role);
                            return (
                                <label
                                    key={role}
                                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${checked
                                        ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                                        : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20"
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                            setSelectedRoles((current) =>
                                                current.includes(role)
                                                    ? current.filter((value) => value !== role)
                                                    : [...current, role]
                                            );
                                        }}
                                        className="h-4 w-4 rounded border-white/20 bg-transparent accent-cyan-500"
                                    />
                                    <span>{role}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Live Run Status</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            {swarmId ? `Swarm ID: ${swarmId}` : "Start a run to see role-by-role progress."}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={!swarmId || isRefreshing}
                        onClick={() => refreshStatus(swarmId)}
                    >
                        {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Refresh
                    </Button>
                </div>

                {status && (
                    <div className="mt-6 space-y-5">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                                <span>Completion</span>
                                <span>{completionPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10">
                                <div
                                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                                    style={{ width: `${completionPercent}%` }}
                                />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                                <span className="rounded-full bg-white/5 px-2 py-1">Total {status.counts.total}</span>
                                <span className="rounded-full bg-white/5 px-2 py-1">Pending {status.counts.pending}</span>
                                <span className="rounded-full bg-white/5 px-2 py-1">Running {status.counts.running}</span>
                                <span className="rounded-full bg-white/5 px-2 py-1">Completed {status.counts.completed}</span>
                                <span className="rounded-full bg-white/5 px-2 py-1">Failed {status.counts.failed}</span>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            {status.tasks.map((task) => (
                                <div
                                    key={task.taskId}
                                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{task.role}</p>
                                            <p className="text-xs text-slate-400">
                                                Agent: {task.agentName} • Updated {new Date(task.updatedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${statusPillClass(task.status)}`}>
                                            {task.status}
                                        </div>
                                    </div>
                                    {task.summary && (
                                        <p className="mt-3 text-sm leading-6 text-slate-300">{task.summary}</p>
                                    )}
                                    {task.behaviorReport && (
                                        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-cyan-100">
                                                        {task.behaviorReport.persona || "User behavior persona"}
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-400">
                                                        {task.behaviorReport.scenario}
                                                    </p>
                                                </div>
                                                <span className="w-fit rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                                                    Friction {task.behaviorReport.frictionScore ?? 0}/100
                                                </span>
                                            </div>
                                            {Array.isArray(task.behaviorReport.journey) && task.behaviorReport.journey.length > 0 && (
                                                <p className="mt-3 text-xs text-slate-400">
                                                    Journey: {task.behaviorReport.journey.join(" -> ")}
                                                </p>
                                            )}
                                            {Array.isArray(task.behaviorReport.findings) && task.behaviorReport.findings.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {task.behaviorReport.findings.slice(0, 3).map((finding, index) => (
                                                        <div key={`${task.taskId}-finding-${index}`} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                                                                {finding.severity || "medium"} friction
                                                            </p>
                                                            <p className="mt-1 text-sm text-slate-200">{finding.friction}</p>
                                                            <p className="mt-1 text-xs leading-5 text-slate-400">{finding.recommendation}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {task.failureReason && (
                                        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                            {task.failureReason}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
