"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [latestInviteLink, setLatestInviteLink] = useState("");
    const [newUser, setNewUser] = useState({
        email: "",
        enterpriseRole: "SALES_USER"
    });
    const [roleEdits, setRoleEdits] = useState<Record<string, { role: string; enterpriseRole: string }>>({});

    const roleOptions = ["user", "admin", "superadmin"];
    const enterpriseRoleOptions = [
        "SUPER_ADMIN",
        "SYSTEM_ADMIN",
        "ORG_ADMIN",
        "CMS_EDITOR",
        "SALES_MANAGER",
        "SALES_USER",
        "CALLER",
        "VIEWER",
        "COMPLIANCE_OFFICER"
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                setError(null);
                const data = await res.json();
                setUsers(data);
                const mapped = data.reduce((acc: any, user: any) => {
                    acc[user.id] = {
                        role: user.role || "user",
                        enterpriseRole: user.enterpriseRole || "SALES_USER"
                    };
                    return acc;
                }, {});
                setRoleEdits(mapped);
            } else if (res.status === 403) {
                setError("You don't have permission to view users.");
            } else {
                setError("Failed to load users.");
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/admin/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // POST /api/admin/invites reads `role`, not `enterpriseRole` - sending
                // `newUser` as-is silently dropped the selected role and always invited
                // as the default SALES_USER regardless of the dropdown.
                body: JSON.stringify({ email: newUser.email, role: newUser.enterpriseRole })
            });
            if (res.ok) {
                const data = await res.json();
                setLatestInviteLink(data.inviteLink || "");
                setShowCreate(false);
                setNewUser({ email: "", enterpriseRole: "SALES_USER" });
                fetchUsers();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "Failed to invite user");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleRoleUpdate = async (userId: string) => {
        const update = roleEdits[userId];
        if (!update) return;

        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: userId,
                    role: update.role,
                    enterpriseRole: update.enterpriseRole
                })
            });
            if (!res.ok) {
                alert("Failed to update user roles");
            } else {
                fetchUsers();
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-8 min-h-screen bg-foreground relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <SectionHeader title="User Management" subtitle="Invite-only Admin Console" />
                    <div className="flex gap-3">
                        <Link href="/admin/invites" className="border border-foreground/10 text-foreground px-4 py-2 rounded-lg font-medium transition-colors hover:bg-foreground/5">
                            View Invites
                        </Link>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            + Invite User
                        </button>
                    </div>
                </div>

                {latestInviteLink && (
                    <div className="mb-6 rounded-xl border border-success/20 bg-success/10 p-4 text-success">
                        <div className="mb-2 text-sm font-semibold">Invite link</div>
                        <div className="flex gap-2">
                            <input readOnly value={latestInviteLink} className="min-w-0 flex-1 rounded-lg border border-foreground/10 bg-foreground/30 px-3 py-2 text-sm text-foreground" />
                            <button onClick={() => navigator.clipboard.writeText(latestInviteLink)} className="rounded-lg bg-success px-3 py-2 text-sm text-primary-foreground hover:bg-success">
                                Copy
                            </button>
                        </div>
                    </div>
                )}

                {/* Create User Modal */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
                        <div className="bg-background border border-foreground/10 p-8 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold text-foreground mb-6">Invite User</h3>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2 text-foreground"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">Enterprise Role</label>
                                    <select
                                        value={newUser.enterpriseRole}
                                        onChange={(e) => setNewUser({ ...newUser, enterpriseRole: e.target.value })}
                                        className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2 text-foreground"
                                    >
                                        {enterpriseRoleOptions.map((role) => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(false)}
                                        className="flex-1 px-4 py-2 rounded-lg border border-foreground/10 text-foreground hover:bg-foreground/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        Send Invite
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Users Table */}
                <div className="glass rounded-xl border border-foreground/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-foreground/5 text-muted-foreground text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Enterprise Role</th>
                                <th className="px-6 py-4">Joined</th>
                                <th className="px-6 py-4 text-right">Teams</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                            {loading ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={6}>Loading users...</td></tr>
                            ) : error ? (
                                <tr><td className="px-6 py-6 text-destructive" colSpan={6}>{error}</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td className="px-6 py-6 text-muted-foreground" colSpan={6}>No users yet.</td></tr>
                            ) : users.map((user) => (
                                <tr key={user.id} className="hover:bg-foreground/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-foreground font-medium">{user.name || "Unknown"}</div>
                                        <div className="text-muted-foreground text-sm">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={roleEdits[user.id]?.role || user.role || "user"}
                                            onChange={(e) =>
                                                setRoleEdits((prev) => ({
                                                    ...prev,
                                                    [user.id]: {
                                                        role: e.target.value,
                                                        enterpriseRole: prev[user.id]?.enterpriseRole || user.enterpriseRole || "SALES_USER"
                                                    }
                                                }))
                                            }
                                            className="bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm"
                                        >
                                            {roleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={roleEdits[user.id]?.enterpriseRole || user.enterpriseRole || "SALES_USER"}
                                            onChange={(e) =>
                                                setRoleEdits((prev) => ({
                                                    ...prev,
                                                    [user.id]: {
                                                        role: prev[user.id]?.role || user.role || "user",
                                                        enterpriseRole: e.target.value
                                                    }
                                                }))
                                            }
                                            className="bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm"
                                        >
                                            {enterpriseRoleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground text-sm">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-muted-foreground text-sm">
                                        {user.memberships?.length || 0}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRoleUpdate(user.id)}
                                            className="px-3 py-1.5 rounded-lg bg-foreground/10 text-foreground text-sm hover:bg-foreground/20"
                                        >
                                            Save
                                        </button>
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
