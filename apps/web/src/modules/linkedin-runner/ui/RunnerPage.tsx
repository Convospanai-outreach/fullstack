"use client";

import { useState } from "react";
import { Chrome, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { toRunnerProfileUrl } from "./profileUrl";

export default function RunnerPage() {
    const [response, setResponse] = useState<any>(null);
    const [running, setRunning] = useState(false);
    const [profileInput, setProfileInput] = useState("");
    const profileUrl = toRunnerProfileUrl(profileInput);
    const apiBase = getBrowserApiBase();
    const extensionBase =
        typeof window !== "undefined"
            ? `${window.location.origin}/api/proxy/extension`
            : "http://localhost:3000/api/proxy/extension";

    async function run() {
        if (!profileUrl) return;
        setRunning(true);
        try {
            const res = await fetch(apiBase + "/linkedin-runner/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileUrl,
                    action: "scrape",
                }),
            }).then((r) => r.json());
            setResponse(res);
        } catch (error: any) {
            setResponse({ error: error?.message || "Failed to trigger linkedin-runner" });
        } finally {
            setRunning(false);
        }
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-10">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">LinkedIn Operations</p>
                    <h1 className="text-3xl font-bold text-foreground">LinkedIn Outreach Control</h1>
                    <p className="text-sm text-muted-foreground">
                        Use Chrome extension for operator-assisted outreach. Keep direct automation runner for controlled testing only.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassCard className="p-6 border border-primary/30 bg-primary/20">
                        <div className="flex items-center gap-2 text-primary">
                            <Chrome className="h-5 w-5" />
                            <h2 className="text-lg font-semibold text-foreground">Recommended: Chrome Extension</h2>
                        </div>
                        <p className="mt-3 text-sm text-foreground/80">
                            Local extension keeps LinkedIn session on the browser machine and reports approved actions back to CraftMyFunnel.
                        </p>
                        <div className="mt-4 rounded-lg border border-foreground/10 bg-background/60 p-3 text-xs text-foreground/80">
                            Endpoint: <span className="text-foreground break-all">{extensionBase}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Open the extension popup and click Connect to link it to your account.
                        </p>
                    </GlassCard>

                    <GlassCard className="p-6 border border-warning/30 bg-warning/20">
                        <div className="flex items-center gap-2 text-warning">
                            <ShieldCheck className="h-5 w-5" />
                            <h2 className="text-lg font-semibold text-foreground">Advanced: Runner Test</h2>
                        </div>
                        <p className="mt-3 text-sm text-foreground/80">
                            Triggers backend linkedin-runner route for controlled smoke tests.
                        </p>
                        <label htmlFor="runner-profile-url" className="mt-4 block text-xs font-medium text-foreground">
                            LinkedIn profile to test against
                        </label>
                        <Input
                            id="runner-profile-url"
                            className="mt-1"
                            placeholder="https://www.linkedin.com/in/their-handle"
                            value={profileInput}
                            onChange={(e) => setProfileInput(e.target.value)}
                        />
                        {profileInput.trim() && !profileUrl && (
                            <p className="mt-1 text-xs text-destructive">Enter a linkedin.com/in/ profile URL.</p>
                        )}
                        <Button onClick={run} disabled={running || !profileUrl} className="mt-4">
                            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                            Run test action
                        </Button>
                    </GlassCard>
                </div>

                <GlassCard className="p-6">
                    <h3 className="text-base font-semibold text-foreground">Runner response</h3>
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-foreground/10 bg-background/70 p-4 text-xs text-foreground">
{JSON.stringify(response || { info: "No run executed yet." }, null, 2)}
                    </pre>
                </GlassCard>
            </div>
        </div>
    );
}
