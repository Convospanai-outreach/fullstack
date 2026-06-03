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

export default function InvitesPage() {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvites = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/invites");
            if (res.ok) setInvites(await res.json());
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

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <SectionHeader title="Invitations" subtitle="Pending and historical invite links" />
                    <Link href="/admin/users" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                        Invite User
                    </Link>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-sm uppercase text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Team</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Expires</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {loading ? (
                                <tr><td className="px-6 py-6 text-gray-400" colSpan={6}>Loading invites...</td></tr>
                            ) : invites.length === 0 ? (
                                <tr><td className="px-6 py-6 text-gray-400" colSpan={6}>No invites yet.</td></tr>
                            ) : invites.map((invite) => (
                                <tr key={invite.id} className="hover:bg-white/5">
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{invite.email}</div>
                                        <div className="text-xs text-gray-500">Invited by {invite.invitedBy?.name || invite.invitedBy?.email || "admin"}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">{invite.role}</td>
                                    <td className="px-6 py-4 text-gray-300">{invite.team?.name || "-"}</td>
                                    <td className="px-6 py-4">
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">{invite.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">{new Date(invite.expiresAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {invite.status === "pending" && (
                                            <button onClick={() => revokeInvite(invite.id)} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/25">
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
        </main>
    );
}
