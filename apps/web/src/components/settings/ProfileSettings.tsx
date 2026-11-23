"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface SettingsData {
    name?: string;
    email?: string;
}

interface ProfileSettingsProps {
    settings: SettingsData | null;
    onUpdate: (data: SettingsData) => Promise<void>;
}

export function ProfileSettings({ settings, onUpdate }: ProfileSettingsProps) {
    const [name, setName] = useState(settings?.name || "");
    const [email, setEmail] = useState(settings?.email || "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onUpdate({ name, email });
        setLoading(false);
    };

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">Profile Information</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-muted-foreground mb-1">Full Name</label>
                    <input
                        type="text"
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-lg p-3 text-foreground focus:outline-none focus:border-primary/30"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm text-muted-foreground mb-1">Email Address</label>
                    <input
                        type="email"
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-lg p-3 text-foreground focus:outline-none focus:border-primary/30"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <Button variant="default" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </form>
        </GlassCard>
    );
}
