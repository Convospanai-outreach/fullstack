"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TeamSettings() {
    const { data: team, mutate } = useSWR(process.env['NEXT_PUBLIC_API_URL'] + "/team", fetcher);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setInviteLink(null);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/team/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to invite");

            toast.success("Invitation created!");
            setInviteLink(data.inviteLink);
            mutate(); // Refresh member list
            setInviteEmail("");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/team/members/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to remove");
            toast.success("Member removed");
            mutate();
        } catch (err) {
            toast.error("Error removing member");
        }
    };

    const handleRoleUpdate = async (id: string, newRole: string) => {
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/team/members/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) throw new Error("Failed to update role");
            toast.success("Role updated");
            mutate();
        } catch (err) {
            toast.error("Error updating role");
        }
    };

    if (!team) return <div className="p-8 text-center text-gray-400">Loading team...</div>;
    // Assuming /api/team returns { ...team, members: [...] }
    const members = team.members || [];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold text-white">Team Members</h3>
                <p className="text-sm text-gray-400">Manage your team and invites.</p>
            </div>

            {/* Invite Form */}
            <div className="glass p-6 rounded-xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Invite New Member</h4>
                <form onSubmit={handleInvite} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            placeholder="colleague@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Role</label>
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                        {loading ? "Inviting..." : "Send Invite"}
                    </button>
                </form>
                {inviteLink && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                        <p className="font-semibold mb-1">Invitation Link Generated:</p>
                        <code className="block bg-black/20 p-2 rounded select-all">{inviteLink}</code>
                    </div>
                )}
            </div>

            {/* Member List */}
            <div className="glass p-6 rounded-xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Current Members</h4>
                <div className="flex flex-col gap-2">
                    {members.length === 0 ? (
                        <div className="text-gray-500 italic">No other members yet.</div>
                    ) : (
                        members.map((m: any) => (
                            <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                <div>
                                    <div className="text-white font-medium">{m.email}</div>
                                    <div className="text-xs text-gray-400 flex gap-2 items-center">
                                        <span className={`uppercase font-bold text-[10px] ${m.status === 'invited' ? 'text-yellow-500' : 'text-green-500'}`}>
                                            {m.status}
                                        </span>
                                        •
                                        Added {new Date(m.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={m.role}
                                        onChange={(e) => handleRoleUpdate(m.id, e.target.value)}
                                        className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                    <button
                                        onClick={() => handleRemove(m.id)}
                                        className="text-red-400 hover:text-red-300 p-2"
                                        title="Remove member"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
