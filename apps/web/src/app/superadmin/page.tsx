"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import SuperAdminDashboardClient from "./SuperAdminDashboardClient";

type View = "checking" | "login" | "dashboard";

export default function SuperAdminPage() {
    const [view, setView] = useState<View>("checking");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/superadmin/overview?range=30d", { cache: "no-store" }).catch(() => null);
            setView(res && res.status !== 401 ? "dashboard" : "login");
        })();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/superadmin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || "Login failed");
                return;
            }
            setPassword("");
            setView("dashboard");
        } finally {
            setSubmitting(false);
        }
    };

    if (view === "checking") {
        return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Checking session...</div>;
    }

    if (view === "dashboard") {
        return <SuperAdminDashboardClient onLoggedOut={() => setView("login")} />;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-lg">
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-warning">
                        <Lock className="h-5 w-5" />
                    </span>
                    <h1 className="text-lg font-bold text-foreground">Superadmin Access</h1>
                    <p className="text-xs text-muted-foreground">
                        Separate credentials from your regular account. Not tied to Google sign-in.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                        <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign in"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
