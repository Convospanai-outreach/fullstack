"use client";

import { useState, useEffect } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import MeetingList from "@/components/calendar/MeetingList";
import ReadyReckonerPanel from "@/components/calendar/ReadyReckonerPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

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

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/meetings", {
                credentials: "include",
            });
            const data = await res.json();
            setMeetings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch meetings", error);
        } finally {
            // No loading state needed
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Calendar"
                    subtitle="Manage your upcoming meetings and calls."
                />
                <Button variant="default">Schedule Meeting</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <MeetingList meetings={meetings} />
                </div>
                <div>
                    <GlassCard>
                        <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Upcoming</span>
                                <span className="text-white font-medium">{meetings.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">This Week</span>
                                <span className="text-white font-medium">
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
