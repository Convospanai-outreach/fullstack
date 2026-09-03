"use client";

import { useState, useEffect } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import MeetingList from "@/components/calendar/MeetingList";
import ReadyReckonerPanel from "@/components/calendar/ReadyReckonerPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

type CalendarMeeting = {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    lead?: {
        fullName?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: string | null;
    } | null;
    notes?: string | null;
};

export default function CalendarPage() {
    const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const res = await fetch(getBrowserApiBase() + "/meetings", {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to fetch meetings");
            const data = await res.json();
            setMeetings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch meetings", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setStartTime("");
        setEndTime("");
        setNotes("");
    };

    const handleScheduleMeeting = async () => {
        if (!title.trim() || !startTime || !endTime) {
            toast.error("Title, start time, and end time are required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/meetings", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    notes: notes.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Failed to schedule meeting");
            }
            toast.success("Meeting scheduled");
            setShowScheduleModal(false);
            resetForm();
            fetchMeetings();
        } catch (error: any) {
            toast.error(error?.message || "Failed to schedule meeting");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Calendar"
                    subtitle="Manage your upcoming meetings and calls."
                />
                <Button variant="default" onClick={() => setShowScheduleModal(true)}>Schedule Meeting</Button>
            </div>

            <Modal
                open={showScheduleModal}
                onClose={() => { setShowScheduleModal(false); resetForm(); }}
                title="Schedule Meeting"
                footer={
                    <>
                        <Button variant="outline" onClick={() => { setShowScheduleModal(false); resetForm(); }} disabled={saving}>Cancel</Button>
                        <Button variant="default" onClick={handleScheduleMeeting} disabled={saving}>
                            {saving ? "Scheduling..." : "Schedule"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="meeting-title" className="text-sm text-muted-foreground">Title</label>
                        <input
                            id="meeting-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Intro call with Acme Corp"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label htmlFor="meeting-start" className="text-sm text-muted-foreground">Start</label>
                            <input
                                id="meeting-start"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="meeting-end" className="text-sm text-muted-foreground">End</label>
                            <input
                                id="meeting-end"
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="meeting-notes" className="text-sm text-muted-foreground">Notes (optional)</label>
                        <textarea
                            id="meeting-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            rows={3}
                        />
                    </div>
                </div>
            </Modal>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {loading ? (
                        <GlassCard className="p-8 text-center text-muted-foreground text-sm">Loading meetings...</GlassCard>
                    ) : loadError ? (
                        <GlassCard className="p-8 text-center text-sm text-destructive">
                            Couldn't load meetings. <button onClick={fetchMeetings} className="underline hover:text-destructive/80">Retry</button>
                        </GlassCard>
                    ) : (
                        <MeetingList meetings={meetings} />
                    )}
                </div>
                <div>
                    <GlassCard>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Upcoming</span>
                                <span className="text-foreground font-medium">{meetings.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">This Week</span>
                                <span className="text-foreground font-medium">
                                    {meetings.filter((m: any) => {
                                        const date = new Date(m.startTime);
                                        const now = new Date();
                                        const nextWeek = new Date();
                                        nextWeek.setDate(now.getDate() + 7);
                                        return date >= now && date <= nextWeek;
                                    }).length}
                                </span>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>

            <ReadyReckonerPanel meetings={meetings} />
        </div>
    );
}
