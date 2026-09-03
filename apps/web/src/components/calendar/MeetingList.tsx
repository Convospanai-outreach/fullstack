"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";

interface Meeting {
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
}

interface MeetingListProps {
    meetings: Meeting[];
}

export default function MeetingList({ meetings = [] }: MeetingListProps) {
    return (
        <div className="space-y-4">
            {meetings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No upcoming meetings</div>
            ) : (
                meetings.map((meeting) => (
                    <GlassCard key={meeting.id} className="flex justify-between items-center hover:bg-accent transition">
                        <div className="flex gap-4 items-center">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/10 rounded-lg text-primary">
                                <span className="text-xs font-bold uppercase">{new Date(meeting.startTime).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-lg font-bold">{new Date(meeting.startTime).getDate()}</span>
                            </div>
                            <div>
                                <h4 className="text-foreground font-medium">{meeting.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                    {new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            {meeting.lead && (
                                <p className="text-sm text-primary mb-1">with {meeting.lead.fullName}</p>
                            )}
                            <Badge variant="default">Scheduled</Badge>
                        </div>
                    </GlassCard>
                ))
            )}
        </div>
    );
}
