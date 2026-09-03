"use client";

import { useEffect, useState } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
// Switch import removed as checkbox is used for now
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ShieldAlert,
    Trash2,
    Plus,
    Settings,
    ShieldCheck,
    Save,
    Info,
    Lock,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function GuardrailsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policy, setPolicy] = useState<any>(null);
    const [loadError, setLoadError] = useState(false);
    const [newItem, setNewItem] = useState({ block: "", competitor: "" });

    useEffect(() => {
        fetch(getBrowserApiBase() + "/governance/guardrails")
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setPolicy(data.policy);
                } else {
                    setLoadError(true);
                }
                setLoading(false);
            })
            .catch(() => {
                setLoadError(true);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/governance/guardrails", {
                method: "POST",
                body: JSON.stringify(policy),
            });
            if (res.ok) toast.success("Policy updated successfully");
        } catch (err) {
            toast.error("Failed to update policy");
        } finally {
            setSaving(false);
        }
    };

    const addItem = (type: "blocklist" | "competitorMentions", value: string) => {
        if (!value) return;
        setPolicy({
            ...policy,
            [type]: [...policy[type], value]
        });
        setNewItem({ ...newItem, [type === "blocklist" ? "block" : "competitor"]: "" });
    };

    const removeItem = (type: "blocklist" | "competitorMentions", index: number) => {
        const list = [...policy[type]];
        list.splice(index, 1);
        setPolicy({ ...policy, [type]: list });
    };

    if (loading) return <GovernanceLayout>Loading Policy...</GovernanceLayout>;
    if (loadError || !policy) return <GovernanceLayout>Failed to load guardrail policy. Please try again later.</GovernanceLayout>;

    return (
        <GovernanceLayout>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-accent-violet/10 p-2.5 rounded-xl text-accent-violet">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Safety Engine Configuration</h2>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Synchronize Policy
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Content Controls */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Restricted Vocabulary</CardTitle>
                            <CardDescription>AI will be blocked from generating these exact phrases</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 mb-4">
                                <Input
                                    placeholder="e.g. 'crypto', 'unbeatable price'..."
                                    value={newItem.block}
                                    onChange={(e) => setNewItem({ ...newItem, block: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && addItem("blocklist", newItem.block)}
                                />
                                <Button variant="ghost" onClick={() => addItem("blocklist", newItem.block)}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {policy.blocklist.map((item: string, i: number) => (
                                    <Badge key={i} variant="danger" className="pl-3 gap-2 py-1.5">
                                        {item}
                                        <button onClick={() => removeItem("blocklist", i)}>
                                            <Trash2 className="w-3 h-3 hover:text-foreground" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Competitor Awareness</CardTitle>
                            <CardDescription>Flag messages that mention these rival entities</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 mb-4">
                                <Input
                                    placeholder="Enter competitor name..."
                                    value={newItem.competitor}
                                    onChange={(e) => setNewItem({ ...newItem, competitor: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && addItem("competitorMentions", newItem.competitor)}
                                />
                                <Button variant="ghost" onClick={() => addItem("competitorMentions", newItem.competitor)}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {policy.competitorMentions.map((item: string, i: number) => (
                                    <Badge key={i} variant="warning" className="pl-3 gap-2 py-1.5">
                                        {item}
                                        <button onClick={() => removeItem("competitorMentions", i)}>
                                            <Trash2 className="w-3 h-3 hover:text-foreground" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Global Controls */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Governance Rules</CardTitle>
                            <CardDescription>System-wide security toggles</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl glass border border-border">
                                    <div className="flex gap-3">
                                        <ShieldCheck className="w-5 h-5 text-accent-mint" />
                                        <div>
                                            <label className="text-sm font-bold text-foreground block">PII Redaction</label>
                                            <span className="text-[10px] text-muted-foreground">Automatically mask emails, phones, and addresses</span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={policy.detectPII}
                                        onChange={(e) => setPolicy({ ...policy, detectPII: e.target.checked })}
                                        className="w-5 h-5 accent-primary"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl glass border border-border">
                                    <div className="flex gap-3">
                                        <ShieldAlert className="w-5 h-5 text-orange-400" />
                                        <div>
                                            <label className="text-sm font-bold text-foreground block">Strict Output Mode</label>
                                            <span className="text-[10px] text-muted-foreground">Discard AI output if any guardrail is triggered</span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={policy.strictness === "high"}
                                        onChange={(e) => setPolicy({ ...policy, strictness: e.target.checked ? "high" : "medium" })}
                                        className="w-5 h-5 accent-primary"
                                    />
                                </div>

                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-primary" />
                                        Engagement Limits
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Max Daily Outbound (per user)</span>
                                            <input
                                                type="number"
                                                value={policy.maxDailyMsgs}
                                                onChange={(e) => setPolicy({ ...policy, maxDailyMsgs: parseInt(e.target.value) })}
                                                className="bg-background border border-border rounded-lg px-2 py-1 w-20 text-right text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                                            />
                                        </div>
                                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-1/3" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="glass p-6 rounded-2xl border-dashed border-2 border-border flex flex-col items-center text-center">
                        <Lock className="w-8 h-8 text-muted-foreground mb-3" />
                        <h4 className="text-sm font-bold text-foreground">Advanced Policy Editor</h4>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">Upload custom RegEx patterns for deep content introspection.</p>
                        <Button variant="outline" className="text-xs w-full">Enable RegEx Layer (Beta)</Button>
                    </div>
                </div>
            </div>
        </GovernanceLayout>
    );
}
