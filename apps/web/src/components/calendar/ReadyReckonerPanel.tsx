"use client";

import { useMemo, useState } from "react";
import { Clipboard, FileText, Mail, Send } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";

type Meeting = {
    id: string;
    title: string;
    startTime: string;
    lead?: {
        fullName?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: string | null;
    } | null;
    notes?: string | null;
};

type ReadyReckonerDraft = {
    subject: string;
    text: string;
    html: string;
};

type ReadyReckonerPanelProps = {
    meetings: Meeting[];
};

const initialForm = {
    meetingId: "",
    clientName: "",
    companyName: "",
    industry: "",
    competition: "",
    meetingType: "Introductory call",
    meetingRemarks: "",
    emailBackground: "",
    linkedinBackground: "",
    callBackground: "",
    clientEmail: "",
    phoneNumber: "",
};

export default function ReadyReckonerPanel({ meetings }: ReadyReckonerPanelProps) {
    const [form, setForm] = useState(initialForm);
    const [draft, setDraft] = useState<ReadyReckonerDraft | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const selectedMeeting = useMemo(
        () => meetings.find((meeting) => meeting.id === form.meetingId),
        [meetings, form.meetingId]
    );

    function updateField(field: keyof typeof initialForm, value: string) {
        setForm((current) => ({ ...current, [field]: value }));
        setError("");
        setMessage("");
    }

    function selectMeeting(meetingId: string) {
        const meeting = meetings.find((item) => item.id === meetingId);
        setForm((current) => ({
            ...current,
            meetingId,
            clientName: meeting?.lead?.fullName ?? current.clientName,
            companyName: meeting?.lead?.company ?? current.companyName,
            clientEmail: meeting?.lead?.email ?? current.clientEmail,
            phoneNumber: meeting?.lead?.phone ?? current.phoneNumber,
            meetingRemarks: meeting?.notes ?? current.meetingRemarks,
        }));
        setDraft(null);
        setError("");
        setMessage("");
    }

    async function prepareDraft(send = false) {
        setError("");
        setMessage("");
        if (send) {
            setIsSending(true);
        } else {
            setIsPreparing(true);
        }

        try {
            const res = await fetch(`${(process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy")}/meetings/ready-reckoner`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    ...form,
                    meetingId: form.meetingId || undefined,
                    send,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error ?? "Unable to prepare ready reckoner");
            }

            setDraft(data.draft);
            setMessage(send ? "Ready reckoner sent." : "Ready reckoner prepared.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to prepare ready reckoner");
        } finally {
            setIsPreparing(false);
            setIsSending(false);
        }
    }

    async function copyDraft() {
        if (!draft) return;
        await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.text}`);
        setMessage("Copied to clipboard.");
        setError("");
    }

    const mailtoHref = draft
        ? `mailto:${encodeURIComponent(form.clientEmail)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.text)}`
        : undefined;

    return (
        <GlassCard className="space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-white">
                        <FileText className="h-4 w-4 text-cyan-300" />
                        <h3 className="text-lg font-semibold">Meeting ready reckoner</h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                        Build the pre-meeting email from caller notes, prior touchpoints, and client contact details.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-gray-200">
                    Fixed meeting
                    <select
                        value={form.meetingId}
                        onChange={(event) => selectMeeting(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-brand-500"
                    >
                        <option value="">Select meeting</option>
                        {meetings.map((meeting) => (
                            <option key={meeting.id} value={meeting.id}>
                                {meeting.title} - {new Date(meeting.startTime).toLocaleString()}
                            </option>
                        ))}
                    </select>
                </label>
                <Input
                    label="Meeting type"
                    value={form.meetingType}
                    onChange={(event) => updateField("meetingType", event.target.value)}
                    placeholder="Discovery, demo, pricing, renewal"
                />
                <Input
                    label="Client name"
                    value={form.clientName}
                    onChange={(event) => updateField("clientName", event.target.value)}
                    placeholder="Amit Sharma"
                />
                <Input
                    label="Company name"
                    value={form.companyName}
                    onChange={(event) => updateField("companyName", event.target.value)}
                    placeholder="Acme Pvt Ltd"
                />
                <Input
                    label="Industry"
                    value={form.industry}
                    onChange={(event) => updateField("industry", event.target.value)}
                    placeholder="Manufacturing, SaaS, fintech"
                />
                <Input
                    label="Competition"
                    value={form.competition}
                    onChange={(event) => updateField("competition", event.target.value)}
                    placeholder="Optional"
                />
                <Input
                    label="Client email"
                    type="email"
                    value={form.clientEmail}
                    onChange={(event) => updateField("clientEmail", event.target.value)}
                    placeholder="client@company.com"
                />
                <Input
                    label="Phone number"
                    value={form.phoneNumber}
                    onChange={(event) => updateField("phoneNumber", event.target.value)}
                    placeholder="+91 98765 43210"
                />
            </div>

            {selectedMeeting && (
                <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-gray-300">
                    Selected: {selectedMeeting.title} at {new Date(selectedMeeting.startTime).toLocaleString()}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-gray-200 lg:col-span-2">
                    Meeting remarks
                    <Textarea
                        value={form.meetingRemarks}
                        onChange={(event) => updateField("meetingRemarks", event.target.value)}
                        placeholder="Human caller notes, objections, buying signals, expectations, next step promised."
                        className="min-h-28 border-slate-700 bg-slate-950 text-white"
                    />
                </label>
                <label className="space-y-2 text-sm font-medium text-gray-200">
                    Email background
                    <Textarea
                        value={form.emailBackground}
                        onChange={(event) => updateField("emailBackground", event.target.value)}
                        placeholder="Summarize email discussion and replies."
                        className="min-h-28 border-slate-700 bg-slate-950 text-white"
                    />
                </label>
                <label className="space-y-2 text-sm font-medium text-gray-200">
                    LinkedIn background
                    <Textarea
                        value={form.linkedinBackground}
                        onChange={(event) => updateField("linkedinBackground", event.target.value)}
                        placeholder="Summarize LinkedIn messages, profile context, posts, or connection notes."
                        className="min-h-28 border-slate-700 bg-slate-950 text-white"
                    />
                </label>
                <label className="space-y-2 text-sm font-medium text-gray-200 lg:col-span-2">
                    Call background
                    <Textarea
                        value={form.callBackground}
                        onChange={(event) => updateField("callBackground", event.target.value)}
                        placeholder="Summarize prior calls, commitments, blockers, and caller judgement."
                        className="min-h-28 border-slate-700 bg-slate-950 text-white"
                    />
                </label>
            </div>

            <div className="flex flex-wrap gap-3">
                <Button onClick={() => prepareDraft(false)} disabled={isPreparing || isSending}>
                    <Mail className="h-4 w-4" />
                    {isPreparing ? "Preparing" : "Prepare email"}
                </Button>
                <Button variant="secondary" onClick={copyDraft} disabled={!draft}>
                    <Clipboard className="h-4 w-4" />
                    Copy
                </Button>
                <Button asChild variant="outline" disabled={!draft}>
                    <a href={mailtoHref}>
                        <Mail className="h-4 w-4" />
                        Open mail
                    </a>
                </Button>
                <Button variant="outline" onClick={() => prepareDraft(true)} disabled={isPreparing || isSending}>
                    <Send className="h-4 w-4" />
                    {isSending ? "Sending" : "Send via SMTP"}
                </Button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}

            {draft && (
                <div className="space-y-3 rounded-md border border-slate-800 bg-slate-950/80 p-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Subject</p>
                        <p className="text-sm font-medium text-white">{draft.subject}</p>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-4 text-sm leading-6 text-gray-200">
                        {draft.text}
                    </pre>
                </div>
            )}
        </GlassCard>
    );
}
