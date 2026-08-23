"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Settings } from "lucide-react";

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy";

export interface WabaSettings {
    hasWaba: boolean;
    phoneNumberId: string | null;
}

export function WabaSetupCard({ settings, onSaved }: { settings: WabaSettings; onSaved: (next: WabaSettings) => void }) {
    const [editing, setEditing] = useState(false);
    const [phoneNumberId, setPhoneNumberId] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    async function save(hasWaba: boolean) {
        setSaving(true);
        setFormError(null);
        try {
            const res = await fetch(`${API_BASE}/whatsapp/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hasWaba ? { hasWaba, phoneNumberId, accessToken } : { hasWaba: false }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
            onSaved(json);
            setEditing(false);
            setAccessToken("");
        } catch (e: any) {
            setFormError(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">WhatsApp Business API (WABA)</h2>
                {settings.hasWaba ? <Badge variant="info">Automated</Badge> : <Badge variant="secondary">Human-in-the-loop</Badge>}
            </div>

            {settings.hasWaba && !editing ? (
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>Sequence WhatsApp steps send automatically via phone number ID <code>{settings.phoneNumberId}</code>.</p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change credentials</Button>
                        <Button size="sm" variant="outline" onClick={() => save(false)} disabled={saving}>Disable automation</Button>
                    </div>
                </div>
            ) : editing ? (
                <div className="space-y-2 max-w-sm">
                    <p className="text-xs text-muted-foreground">Enter your Meta WhatsApp Business phone number ID and access token. We verify them before saving.</p>
                    <Input placeholder="Phone number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
                    <Input placeholder="Access token" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => save(true)} disabled={saving || !phoneNumberId || !accessToken}>
                            {saving ? "Verifying..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setFormError(null); }}>Cancel</Button>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>No WABA connected. WhatsApp sequence steps will queue a task for a rep to send manually instead of sending automatically.</p>
                    <Button size="sm" onClick={() => setEditing(true)}>Connect a WABA</Button>
                </div>
            )}
        </Card>
    );
}
