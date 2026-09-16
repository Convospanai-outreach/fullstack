"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Fingerprint } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

export interface CrystalSettings {
    hasKey: boolean;
    configuredAt: string | null;
}

export function CrystalSetupCard({ settings, onSaved }: { settings: CrystalSettings; onSaved: (next: CrystalSettings) => void }) {
    const [editing, setEditing] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    async function save(hasKey: boolean) {
        setSaving(true);
        setFormError(null);
        try {
            const res = await fetch(`${API_BASE}/crystal-knows/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hasKey ? { hasKey, apiKey } : { hasKey: false }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
            onSaved(json);
            setEditing(false);
            setApiKey("");
        } catch (e: any) {
            setFormError(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Crystal Knows (DISC Personality Data)</h2>
                {settings.hasKey ? <Badge variant="info">Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
            </div>

            {settings.hasKey && !editing ? (
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>Lead enrichment looks up DISC personality profiles automatically, and AI drafts are tuned to match each recipient&apos;s communication style.</p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change key</Button>
                        <Button size="sm" variant="outline" onClick={() => save(false)} disabled={saving}>Disconnect</Button>
                    </div>
                </div>
            ) : editing ? (
                <div className="space-y-2 max-w-sm">
                    <p className="text-xs text-muted-foreground">
                        Paste your Crystal Knows API key (generate one at data.crystalknows.com/api-keys). We verify it before saving.
                    </p>
                    <Input placeholder="API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => save(true)} disabled={saving || !apiKey}>
                            {saving ? "Verifying..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setFormError(null); }}>Cancel</Button>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>No Crystal Knows key connected. Lead enrichment and AI drafting will skip personality data until one is added.</p>
                    <Button size="sm" onClick={() => setEditing(true)}>Connect Crystal Knows</Button>
                </div>
            )}
        </Card>
    );
}
