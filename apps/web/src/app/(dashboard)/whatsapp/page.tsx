"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { MessageCircle, Users, Phone, Settings } from "lucide-react";

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy";

interface WabaSettings {
    hasWaba: boolean;
    phoneNumberId: string | null;
}

interface WhatsAppMessage {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: string;
    lead: {
        id: string;
        fullName: string | null;
        email: string | null;
        phone: string | null;
    };
}

interface Overview {
    messages: WhatsAppMessage[];
    stats: {
        consentedLeads: number;
        leadsWithPhone: number;
    };
}

function directionBadge(direction: string) {
    return direction === "INBOUND"
        ? <Badge variant="info">Received</Badge>
        : <Badge variant="secondary">Sent</Badge>;
}

function WabaSetupCard({ settings, onSaved }: { settings: WabaSettings; onSaved: (next: WabaSettings) => void }) {
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

export default function WhatsAppPage() {
    const [data, setData] = useState<Overview | null>(null);
    const [settings, setSettings] = useState<WabaSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [overviewRes, settingsRes] = await Promise.all([
                    fetch(`${API_BASE}/whatsapp/overview`),
                    fetch(`${API_BASE}/whatsapp/settings`),
                ]);
                if (!overviewRes.ok) throw new Error(`HTTP ${overviewRes.status}`);
                const overviewJson = await overviewRes.json();
                const settingsJson = settingsRes.ok ? await settingsRes.json() : { hasWaba: false, phoneNumberId: null };
                if (!cancelled) {
                    setData(overviewJson);
                    setSettings(settingsJson);
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) return <div className="p-8">Loading WhatsApp activity...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <MessageCircle className="h-6 w-6" /> WhatsApp
                </h1>
                <p className="text-sm text-muted-foreground">
                    Conversation activity, consent, delivery status, and drip sequence automation.
                </p>
            </div>

            {error && (
                <Card className="p-4 text-sm text-destructive">
                    Couldn&apos;t load WhatsApp activity: {error}
                </Card>
            )}

            {settings && <WabaSetupCard settings={settings} onSaved={setSettings} />}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="p-4 flex items-center gap-3">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-2xl font-bold">{data.stats.consentedLeads}</div>
                                <div className="text-xs text-muted-foreground">Leads with WhatsApp consent</div>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-2xl font-bold">{data.stats.leadsWithPhone}</div>
                                <div className="text-xs text-muted-foreground">Leads with a phone number</div>
                            </div>
                        </Card>
                    </div>

                    <Card className="p-4">
                        <h2 className="text-lg font-semibold mb-3">Recent Messages</h2>
                        {data.messages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No WhatsApp messages yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="py-2 pr-3">Time</th>
                                            <th className="py-2 pr-3">Lead</th>
                                            <th className="py-2 pr-3">Direction</th>
                                            <th className="py-2 pr-3">Message</th>
                                            <th className="py-2 pr-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.messages.map((m) => (
                                            <tr key={m.id} className="border-b last:border-0">
                                                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                                                    {new Date(m.createdAt).toLocaleString()}
                                                </td>
                                                <td className="py-2 pr-3">{m.lead.fullName || m.lead.email || m.lead.phone || m.lead.id}</td>
                                                <td className="py-2 pr-3">{directionBadge(m.direction)}</td>
                                                <td className="py-2 pr-3 max-w-md truncate" title={m.body}>{m.body}</td>
                                                <td className="py-2 pr-3">{m.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
