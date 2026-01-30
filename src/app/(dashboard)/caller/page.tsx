"use client";

import { useState, useEffect } from "react";
// import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface QueueItem {
    id: string; // queue id
    status: string;
    lead: {
        id: string;
        fullName: string;
        phone: string;
        company: string;
        email: string;
        threads: any[];
    }
}

export default function CallerPage() {
    // const { data: session } = useSession();
    const [assigned, setAssigned] = useState<QueueItem[]>([]);
    const [pool, setPool] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Active Focus State
    const [activeLead, setActiveLead] = useState<QueueItem | null>(null);
    const [notes, setNotes] = useState("");

    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/caller/queue");
            if (res.ok) {
                const data = await res.json();
                setAssigned(data.assigned);
                setPool(data.pool);

                // Auto-select first assigned if available
                if (data.assigned.length > 0 && !activeLead) {
                    setActiveLead(data.assigned[0]);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const handleClaim = async (leadId: string) => {
        setProcessingId(leadId);
        try {
            const res = await fetch("/api/caller/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "claim", leadId })
            });
            if (res.ok) {
                await fetchQueue();
            }
        } finally {
            setProcessingId(null);
        }
    };

    const handleOutcome = async (outcome: string) => {
        if (!activeLead) return;
        setProcessingId(activeLead.lead.id);

        // Map UI outcome to Enum
        let enumOutcome = "ENGAGED"; // default fallback
        if (outcome === "booked") enumOutcome = "MEETING_CONFIRMED";
        if (outcome === "vm") enumOutcome = "COORDINATING"; // Keep open
        if (outcome === "closed") enumOutcome = "CLOSED";
        if (outcome === "callback") enumOutcome = "COORDINATING";

        try {
            const res = await fetch("/api/caller/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "complete",
                    leadId: activeLead.lead.id,
                    outcome: enumOutcome,
                    notes
                })
            });
            if (res.ok) {
                setNotes("");
                setActiveLead(null);
                await fetchQueue();
            }
        } finally {
            setProcessingId(null);
        }
    };

    if (loading && !assigned.length && !pool.length) return <div className="p-8">Loading Queue...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sidebar: Queue List */}
            <div className="col-span-1 space-y-6">
                <div>
                    <h3 className="text-lg font-bold mb-2">My Active Tasks ({assigned.length})</h3>
                    <div className="space-y-2">
                        {assigned.map(item => (
                            <Card
                                key={item.id}
                                className={`p-3 cursor-pointer hover:bg-muted ${activeLead?.id === item.id ? 'border-primary' : ''}`}
                                onClick={() => setActiveLead(item)}
                            >
                                <div className="font-semibold">{item.lead.fullName || item.lead.email}</div>
                                <div className="text-xs text-muted-foreground">{item.lead.company}</div>
                                <Badge variant="info" className="mt-1">{item.status}</Badge>
                            </Card>
                        ))}
                        {assigned.length === 0 && <div className="text-sm text-muted-foreground">No active tasks.</div>}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold mb-2">Unassigned Pool</h3>
                    <div className="space-y-2">
                        {pool.map(item => (
                            <Card key={item.id} className="p-3 flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{item.lead.fullName || "Unknown"}</div>
                                    <div className="text-xs text-muted-foreground">{item.lead.company}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={processingId === item.lead.id}
                                    onClick={() => handleClaim(item.lead.id)}
                                >
                                    Claim
                                </Button>
                            </Card>
                        ))}
                        {pool.length === 0 && <div className="text-sm text-muted-foreground">Pool is empty.</div>}
                    </div>
                </div>
            </div>

            {/* Main Area: Focus View */}
            <div className="col-span-2">
                {activeLead ? (
                    <Card className="p-6 h-full flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-3xl font-bold">{activeLead.lead.fullName}</h1>
                                <p className="text-xl text-muted-foreground">{activeLead.lead.company}</p>
                                <div className="mt-2 flex gap-2">
                                    <Badge>{activeLead.lead.phone || "No Phone"}</Badge>
                                    <Badge variant="default">{activeLead.lead.email}</Badge>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
                                <div className="text-lg">COORDINATING</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-muted/20 p-4 rounded-md mb-6 border">
                            <h4 className="text-sm font-semibold mb-2">Context / Thread</h4>
                            {/* Placeholder for thread history */}
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p><strong>AI Assistant:</strong> Scheduling meeting...</p>
                                <p><strong>Lead:</strong> Can we do 2pm?</p>
                                <p className="italic text-xs mt-4">-- Current State Required: Confirm time via Call --</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Textarea
                                placeholder="Call notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[100px]"
                            />

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <Button onClick={() => handleOutcome("booked")} className="bg-green-600 hover:bg-green-700">
                                    Meeting Booked
                                </Button>
                                <Button onClick={() => handleOutcome("callback")} variant="outline">
                                    Callback Needed
                                </Button>
                                <Button onClick={() => handleOutcome("vm")} variant="outline">
                                    Left Voicemail
                                </Button>
                                <Button onClick={() => handleOutcome("closed")} variant="destructive">
                                    Not Interested
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-12 text-muted-foreground">
                        Select a lead to start calling
                    </div>
                )}
            </div>
        </div>
    );
}
