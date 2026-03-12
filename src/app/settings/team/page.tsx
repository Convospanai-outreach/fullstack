"use client";

import { useEffect, useState } from "react";
import {
    UserPlus,
    Trash2,
    Loader2,
    Mail,
    ShieldCheck,
    ShieldAlert,
    UserCheck,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useTeamRole, TeamRole } from "@/hooks/useTeamRole";

interface TeamMember {
    id: string;
    email: string;
    role: string;
    status: string;
    user?: {
        name: string;
        image: string;
    };
    createdAt: string;
}

export default function TeamSettingsPage() {
    const { loading: roleLoading, hasPermission } = useTeamRole();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Invite Form State
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/team/members");
            const data = await res.json();
            if (data.success) {
                setMembers(data.data);
            }
        } catch (error) {
            toast.error("Failed to load members");
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/team/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Invitation sent successfully");
                setIsInviteModalOpen(false);
                setInviteEmail("");
                loadMembers();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to send invitation");
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/team/members/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                toast.success("Member removed");
                loadMembers();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to remove member");
        }
    };

    const handleRoleUpdate = async (id: string, newRole: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/team/members/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Role updated to ${newRole}`);
                loadMembers();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to update role");
        }
    };

    const canManage = hasPermission(TeamRole.ADMIN);
    const isOwner = hasPermission(TeamRole.OWNER);

    if (loading || roleLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Team Members</h1>
                    <p className="text-gray-400 mt-1">Manage workspace access and granular permissions.</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" /> Invite Member
                    </button>
                )}
            </div>

            {/* Members List */}
            <div className="glass-panel overflow-hidden border border-white/10 rounded-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Collaborator</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Access Role</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {members.map((member) => (
                            <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg">
                                                {(member.user?.name || member.email || "?")[0]?.toUpperCase()}
                                            </div>
                                            {member.status === 'active' && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0f172a] flex items-center justify-center">
                                                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                                {member.user?.name || "Pending Account"}
                                                {member.email === members.find(m => m.status === 'active')?.email && (
                                                    <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">You</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                                <Mail className="w-3 h-3" /> {member.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    {canManage ? (
                                        <select
                                            disabled={member.role === TeamRole.OWNER && !isOwner}
                                            value={member.role}
                                            onChange={(e) => handleRoleUpdate(member.id, e.target.value)}
                                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs font-semibold text-gray-300 focus:outline-none focus:border-blue-500/50"
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                            <option value="viewer">Viewer</option>
                                            {isOwner && <option value="owner">Owner</option>}
                                        </select>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 capitalize">
                                            {member.role === 'owner' ? <ShieldAlert className="w-3 h-3 text-red-400" /> :
                                                member.role === 'admin' ? <ShieldCheck className="w-3 h-3 text-blue-400" /> :
                                                    <UserCheck className="w-3 h-3 text-gray-400" />}
                                            {member.role}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                        {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    {canManage && member.role !== TeamRole.OWNER && (
                                        <button
                                            onClick={() => handleRemove(member.id)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center mb-6">
                            <UserPlus className="w-6 h-6 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Invite Collaborator</h2>
                        <p className="text-sm text-gray-400 mb-8">They will receive an email invitation to join your team workspace.</p>

                        <form onSubmit={handleInvite} className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="partner@company.com"
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Permissions Role</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {["member", "admin", "viewer"].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setInviteRole(r)}
                                            className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${inviteRole === r
                                                ? "bg-blue-600 border-blue-500 text-white"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                                }`}
                                        >
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                                >
                                    {inviting ? "Sending..." : "Send Invitation"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className="px-6 bg-white/5 text-gray-400 rounded-xl py-3 font-bold hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
