"use client";

import { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Australia/Sydney",
];

export interface SequenceMailbox {
    id: string;
    email: string;
    displayName?: string | null;
    status: string;
}

export interface SenderScheduleNodeData {
    senderMailboxIds: string[];
    mailboxes: SequenceMailbox[];
    timezone: string;
    onChange: (update: { senderMailboxIds?: string[]; timezone?: string }) => void;
}

export default function SenderScheduleNode({ data }: NodeProps<SenderScheduleNodeData>) {
    const [sendersOpen, setSendersOpen] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [draftSenderIds, setDraftSenderIds] = useState<string[]>(data.senderMailboxIds);
    const [draftTimezone, setDraftTimezone] = useState(data.timezone);

    const connectedMailboxes = data.mailboxes.filter((m) => m.status === "CONNECTED");

    function openSenders() {
        setDraftSenderIds(data.senderMailboxIds);
        setSendersOpen(true);
    }

    function openSchedule() {
        setDraftTimezone(data.timezone);
        setScheduleOpen(true);
    }

    function toggleSender(id: string) {
        setDraftSenderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }

    function saveSenders() {
        data.onChange({ senderMailboxIds: draftSenderIds });
        setSendersOpen(false);
    }

    function saveSchedule() {
        data.onChange({ timezone: draftTimezone });
        setScheduleOpen(false);
    }

    return (
        <>
            <Card className="w-80 overflow-hidden p-0">
                <div className="grid grid-cols-2 divide-x divide-border">
                    <button type="button" onClick={openSenders} className="p-4 text-left transition hover:bg-accent">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Senders</div>
                        <div className="mt-1 text-sm font-medium">
                            {data.senderMailboxIds.length > 0
                                ? `${data.senderMailboxIds.length} sender${data.senderMailboxIds.length === 1 ? "" : "s"}`
                                : "Select senders"}
                        </div>
                    </button>
                    <button type="button" onClick={openSchedule} className="p-4 text-left transition hover:bg-accent">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Schedule</div>
                        <div className="mt-1 text-sm font-medium">{data.timezone}</div>
                    </button>
                </div>
                <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
            </Card>

            <Dialog open={sendersOpen} onOpenChange={setSendersOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select senders</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                        {connectedMailboxes.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No connected mailboxes yet. Connect one from Settings first.
                            </p>
                        )}
                        {connectedMailboxes.map((mailbox) => (
                            <label
                                key={mailbox.id}
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent"
                            >
                                <input
                                    type="checkbox"
                                    checked={draftSenderIds.includes(mailbox.id)}
                                    onChange={() => toggleSender(mailbox.id)}
                                />
                                <span className="flex-1">
                                    <span className="block">{mailbox.displayName || mailbox.email}</span>
                                    {mailbox.displayName && (
                                        <span className="block text-xs text-muted-foreground">{mailbox.email}</span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={saveSenders}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Schedule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Timezone</label>
                        <select
                            value={draftTimezone}
                            onChange={(e) => setDraftTimezone(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        >
                            {TIMEZONES.map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={saveSchedule}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
