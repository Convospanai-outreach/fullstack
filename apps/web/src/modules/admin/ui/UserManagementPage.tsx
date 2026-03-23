"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newUser, setNewUser] = useState({
        email: "",
        name: "",
        role: "user",
        enterpriseRole: "SALES_USER"
    });
    const [roleEdits, setRoleEdits] = useState<Record<string, { role: string; enterpriseRole: string }>>({});

    const roleOptions = ["user", "admin", "superadmin"];
    const enterpriseRoleOptions = [
        "SYSTEM_ADMIN",
        "ORG_ADMIN",
        "SALES_MANAGER",
        "SALES_USER",
        "CALLER",
        "COMPLIANCE_OFFICER"
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/admin/users");
            if (res.ok) {
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
            } else {
                // Handle non-admin access gracefully
                console.error("Failed to fetch users");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                setShowCreate(false);
                setNewUser({ email: "", name: "", role: "user", enterpriseRole: "SALES_USER" });
                fetchUsers();
            } else {
                alert("Failed to create user");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleRoleUpdate = async (userId: string) => {
        const update = roleEdits[userId];
        if (!update) return;

        try {
            const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/admin/users", {
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

    if (loading) return <div className="p-8 text-white">Loading users...</div>;

    return (
        <main className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <SectionHeader title="User Management" subtitle="Admin Console" />
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        + Create User
                    </button>
                </div>

                {/* Create User Modal */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-white/10 p-8 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold text-white mb-6">Create New User</h3>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Role</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    >
                                        {roleOptions.map((role) => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Enterprise Role</label>
                                    <select
                                        value={newUser.enterpriseRole}
                                        onChange={(e) => setNewUser({ ...newUser, enterpriseRole: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
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
                                        className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Users Table */}
                <div className="glass rounded-xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Enterprise Role</th>
                                <th className="px-6 py-4">Joined</th>
                                <th className="px-6 py-4 text-right">Teams</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-white font-medium">{user.name || "Unknown"}</div>
                                        <div className="text-gray-400 text-sm">{user.email}</div>
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
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
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
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                        >
                                            {enterpriseRoleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400 text-sm">
                                        {user.memberships?.length || 0}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRoleUpdate(user.id)}
                                            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
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
        </main>
    );
}
