
"use client";

import { SovereignConsole } from "@/components/dashboard/SovereignConsole";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ApprovalQueue } from "@/components/dashboard/widgets/ApprovalQueue";

function ActionButton({ endpoint, label, icon }: { endpoint: string, label: string, icon: React.ReactNode }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const res = await fetch(endpoint, { method: "POST" });
            if (!res.ok) throw new Error("Action failed");
            toast.success(`${label} initiated`);
        } catch (e) {
            toast.error(`Failed to ${label.toLowerCase()}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleClick} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            {label}
        </Button>
    );
}

export default function OperatorView() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Operator needs Morning Briefing First */}
            <MorningBriefing />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Reuse Sovereign Console for Deep Technical/Operational Monitoring */}
                    <SovereignConsole />
                </div>

                <div className="space-y-6">
                    {/* Governance Gate / Live Action Queue */}
                    <ApprovalQueue />

                    {/* Quick Controls */}
                    <Card>
                        <CardHeader><CardTitle>Agent Controls</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <ActionButton
                                endpoint="/api/admin/actions/start-scrapers"
                                label="Start All Scrapers"
                                icon={<Play className="w-4 h-4 text-emerald-500" />}
                            />
                            <ActionButton
                                endpoint="/api/admin/actions/pause-outreach"
                                label="Pause Outreach"
                                icon={<Pause className="w-4 h-4 text-amber-500" />}
                            />
                            <ActionButton
                                endpoint="/api/admin/actions/sync-crm"
                                label="Sync CRM"
                                icon={<RefreshCw className="w-4 h-4 text-blue-500" />}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
