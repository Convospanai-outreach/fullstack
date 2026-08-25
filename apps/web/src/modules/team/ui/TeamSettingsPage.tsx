"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function TeamSettingsPage() {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/team");
            const data = await res.json();
            if (Array.isArray(data)) {
                setMembers(data);
            }
        } catch (error) {
            console.error("Failed to fetch members", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            if (res.ok) {
                setInviteEmail("");
                fetchMembers();
            } else {
                alert("Failed to invite member");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            const res = await fetch(`${getBrowserApiBase()}/team/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchMembers();
            } else {
                alert("Failed to remove member");
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading team...</div>;

    return (
        <div className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <SectionHeader title="Team Settings" subtitle="Manage your squad" />

                {/* Invite Form */}
                <div className="glass p-6 rounded-xl border border-white/10 mb-8 mt-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Invite New Member</h3>
                    <form onSubmit={handleInvite} className="flex gap-4">
                        <input
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            type="submit"
                            disabled={inviting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {inviting ? "Inviting..." : "Invite"}
                        </button>
                    </form>
                </div>

                {/* Members List */}
                <div className="glass rounded-xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {members.map((member) => (
                                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-white font-medium">{member.user?.name || "Pending..."}</div>
                                        <div className="text-gray-400 text-sm">{member.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {member.role !== "owner" && (
                                            <button
                                                onClick={() => handleRemove(member.id)}
                                                className="text-red-400 hover:text-red-300 text-sm font-medium"
                                            >
                                                Remove
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
