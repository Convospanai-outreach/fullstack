"use client";

import React, { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface TeamMember {
    id: string;
    email: string;
    role: string;
    status: string;
}

export function TeamSettings() {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchMembers = () => {
        fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/team")
            .then((res) => res.json())
            .then((data) => setMembers(data))
            .catch((err) => console.error(err));
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                setEmail("");
                fetchMembers();
            } else {
                alert("Failed to invite member");
            }
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/team/${id}`, { method: "DELETE" });
            fetchMembers();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">Team Management</h3>

            <form onSubmit={handleInvite} className="flex gap-4 mb-6">
                <input
                    type="email"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <Button variant="default" disabled={loading}>
                    {loading ? "Inviting..." : "Invite Member"}
                </Button>
            </form>

            <div className="space-y-4">
                {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                            <div className="font-medium text-white">{member.email}</div>
                            <div className="text-sm text-gray-400 capitalize">{member.role} • {member.status}</div>
                        </div>
                        {member.role !== "owner" && (
                            <button
                                onClick={() => handleRemove(member.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
                {members.length === 0 && (
                    <div className="text-center text-gray-400 py-4">No team members yet.</div>
                )}
            </div>
        </GlassCard>
    );
}
