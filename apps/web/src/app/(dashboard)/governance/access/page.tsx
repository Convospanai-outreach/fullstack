"use client";

import { useEffect, useState } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import {
    UserPlus,
    Shield,
    Mail,
    MoreHorizontal,
    Lock
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface Member {
    id: string;
    email: string;
    role: string;
    status: string;
    user: {
        name: string | null;
        image: string | null;
    } | null;
}

export default function AccessControlPage() {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        fetch(getBrowserApiBase() + "/governance/members")
            .then(res => res.json())
            .then(data => {
                if (data.success) setMembers(data.members);
                setLoading(false);
            });
    }, []);

    return (
        <GovernanceLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Identity & Access</h2>
                    <p className="text-muted-foreground text-sm">Manage who has access to this workspace and their permission levels.</p>
                </div>
                <Button className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Invite Operator
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                                    <th className="px-6 py-4">Identity</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">2FA</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan={5} className="px-6 py-4">
                                                <Skeleton className="h-12 w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    members.map((member) => (
                                        <tr key={member.id} className="hover:bg-accent transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 to-accent-violet/20 flex items-center justify-center text-foreground font-bold border border-border shadow-sm">
                                                        {member.user?.image ? (
                                                            <img src={member.user.image} alt="" className="w-full h-full rounded-xl object-cover" />
                                                        ) : (
                                                            (member.user?.name || member.email).charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground tracking-tight">{member.user?.name || "Pending Invite"}</p>
                                                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                            <Mail className="w-3 h-3" />
                                                            {member.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                                                    <Shield className="w-3.5 h-3.5 text-primary" />
                                                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <Badge variant={member.status === "active" ? "success" : "warning"}>
                                                    {member.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span className="text-xs text-muted-foreground">Enforced</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6 rounded-2xl border border-primary/20 bg-primary/5">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <Shield className="w-6 h-6" />
                            </div>
                            <Badge variant="info">Enabled</Badge>
                        </div>
                        <h4 className="text-lg font-bold text-foreground">SSO Configuration</h4>
                        <p className="text-sm text-muted-foreground mt-1">SAML/OIDC is currently enforced for all users in the <b>craftmyfunnel.ai</b> domain.</p>
                        <Button variant="outline" className="mt-6 w-full text-xs">Manage Authentication</Button>
                    </div>

                    <div className="glass p-6 rounded-2xl border border-border hover:bg-muted transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-muted rounded-xl text-muted-foreground">
                                <Lock className="w-6 h-6" />
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-foreground">RBAC Groups</h4>
                        <p className="text-sm text-muted-foreground mt-1">Assign users to custom roles with granular permission sets (Editor, Reviewer, Ops).</p>
                        <Button variant="outline" className="mt-6 w-full text-xs" disabled>Available in Enterprise+</Button>
                    </div>
                </div>
            </div>
        </GovernanceLayout>
    );
}
