"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Invite = {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    team?: { name?: string };
    invitedBy?: { name?: string | null; email?: string | null };
};

type InviteRequest = {
    id: string;
    name: string;
    email: string;
    company: string;
    linkedinUrl: string;
    useCase: string;
    status: string;
    inviteToken?: string | null;
    createdAt: string;
    approvedAt?: string | null;
    approvedBy?: { name?: string | null; email?: string | null };
    invitations?: Array<{ id: string; status: string; expiresAt: string; acceptedAt?: string | null }>;
};

export default function InvitesPage() {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchInvites = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/invites");
            if (res.ok) {
                setError(null);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setInvites(data);
                    setInviteRequests([]);
                } else {
                    setInvites(data.invites || []);
                    setInviteRequests(data.inviteRequests || []);
                }
            } else if (res.status === 403) {
                setError("You don't have permission to view invites.");
            } else {
                setError("Failed to load invites.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvites();
    }, []);

    const revokeInvite = async (id: string) => {
        const res = await fetch("/api/admin/invites", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "revoked" })
        });
        if (res.ok) fetchInvites();
    };

    const updateRequest = async (id: string, action: "approve-request" | "reject-request" | "mark-used-request") => {
        setApprovingId(id);
        try {
            const res = await fetch("/api/admin/invites", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action })
            });
            if (res.ok) fetchInvites();
        } finally {
            setApprovingId(null);
        }
    };

    const copyInviteLink = async (token?: string | null) => {
        if (!token) return;
        const link = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
        await navigator.clipboard.writeText(link);
    };

    return (
        <div className="min-h-screen bg-foreground p-8 text-foreground">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <SectionHeader title="Invite Requests" subtitle="Waitlist requests, approvals, and invite links" />
                    <Link href="/admin/users" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
                        Invite User
                    </Link>
                </div>

                <div className="mb-8 overflow-hidden rounded-xl border border-foreground/10">
                    <table className="w-full text-left">
                        <thead className="bg-foreground/5 text-sm uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4">Requester</th>
                                <th className="px-6 py-4">Company</th>
                                <th className="px-6 py-4">Use Case</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                            {loading ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={5}>Loading invite requests...</td></tr>
                            ) : error ? (
                                <tr><td className="px-6 py-6 text-destructive" colSpan={5}>{error}</td></tr>
                            ) : inviteRequests.length === 0 ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={5}>No invite requests yet.</td></tr>
                            ) : inviteRequests.map((request) => (
                                <tr key={request.id} className="hover:bg-foreground/5">
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{request.name}</div>
                                        <div className="text-xs text-muted-foreground">{request.email}</div>
                                        <a className="text-xs text-primary hover:text-primary" href={request.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn profile</a>
                                    </td>
                                    <td className="px-6 py-4 text-foreground/80">{request.company}</td>
                                    <td className="max-w-sm px-6 py-4 text-sm text-muted-foreground">{request.useCase}</td>
                                    <td className="px-6 py-4">
                                        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground">{request.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                        {["WAITLISTED", "APPROVED"].includes(request.status) && (
                                            <button
                                                onClick={() => updateRequest(request.id, "approve-request")}
                                                disabled={approvingId === request.id}
                                                className="rounded-lg bg-success/15 px-3 py-1.5 text-sm text-success hover:bg-success/25 disabled:opacity-60"
                                            >
                                                {approvingId === request.id ? "Approving..." : "Approve"}
                                            </button>
                                        )}
                                        {request.status === "WAITLISTED" && (
                                            <button
                                                onClick={() => updateRequest(request.id, "reject-request")}
                                                disabled={approvingId === request.id}
                                                className="rounded-lg bg-destructive/15 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/25 disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                        )}
                                        {request.inviteToken && (
                                            <button
                                                onClick={() => copyInviteLink(request.inviteToken)}
                                                className="rounded-lg bg-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-primary/25"
                                            >
                                                Copy Invite Link
                                            </button>
                                        )}
                                        {request.status !== "USED" && (
                                            <button
                                                onClick={() => updateRequest(request.id, "mark-used-request")}
                                                disabled={approvingId === request.id}
                                                className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/15 disabled:opacity-60"
                                            >
                                                Mark Used
                                            </button>
                                        )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="overflow-hidden rounded-xl border border-foreground/10">
                    <table className="w-full text-left">
                        <thead className="bg-foreground/5 text-sm uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Team</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Expires</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                            {loading ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={6}>Loading invites...</td></tr>
                            ) : error ? (
                                <tr><td className="px-6 py-6 text-destructive" colSpan={6}>{error}</td></tr>
                            ) : invites.length === 0 ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={6}>No invites yet.</td></tr>
                            ) : invites.map((invite) => (
                                <tr key={invite.id} className="hover:bg-foreground/5">
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{invite.email}</div>
                                        <div className="text-xs text-muted-foreground">Invited by {invite.invitedBy?.name || invite.invitedBy?.email || "admin"}</div>
                                    </td>
                                    <td className="px-6 py-4 text-foreground/80">{invite.role}</td>
                                    <td className="px-6 py-4 text-foreground/80">{invite.team?.name || "-"}</td>
                                    <td className="px-6 py-4">
                                        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground">{invite.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(invite.expiresAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {invite.status === "pending" && (
                                            <button onClick={() => revokeInvite(invite.id)} className="rounded-lg bg-destructive/15 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/25">
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
