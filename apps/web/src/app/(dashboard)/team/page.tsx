"use client";

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Input } from '@/components/ui/Input';
import { Loader2, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function TeamPage() {
    const [activeTab, setActiveTab] = useState('members');
    const [members, setMembers] = useState<any[]>([]);
    const [policy, setPolicy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [membersRes, policyRes] = await Promise.all([
                fetch(getBrowserApiBase() + '/team/members'),
                fetch(getBrowserApiBase() + '/team/policy')
            ]);
            const membersPayload = await membersRes.json();
            setMembers(Array.isArray(membersPayload) ? membersPayload : membersPayload.data || []);
            setPolicy(await policyRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (email: string, role: string) => {
        const toastId = toast.loading("Inviting...");
        try {
            const res = await fetch(getBrowserApiBase() + '/team/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role })
            });
            if (!res.ok) throw new Error("Failed");
            toast.dismiss(toastId);
            toast.success("Invited!");
            fetchData();
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Failed to invite");
        }
    };

    const handlePolicyUpdate = async () => {
        const toastId = toast.loading("Saving policy...");
        try {
            const res = await fetch(getBrowserApiBase() + '/team/policy', {
                method: 'PATCH',
                body: JSON.stringify(policy)
            });
            if (!res.ok) throw new Error("Failed");
            toast.dismiss(toastId);
            toast.success("Policy updated");
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Failed to update");
        }
    };

    return (
        <div className="space-y-8 animate-reveal">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-foreground">Team Governance</h1>
                <div className="flex gap-2 bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'members' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Members
                    </button>
                    <button
                        onClick={() => setActiveTab('policy')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'policy' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Policies
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
                <>
                    {activeTab === 'members' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <GlassCard className="lg:col-span-2">
                                <h3 className="text-lg font-bold mb-4">Active Members</h3>
                                <div className="space-y-4">
                                    {members.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent-violet/20 flex items-center justify-center text-accent-violet font-bold">
                                                    {m.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">{m.email}</div>
                                                    <div className="text-xs text-muted-foreground capitalize">{m.role} • {m.status}</div>
                                                </div>
                                            </div>
                                            <button className="text-xs text-muted-foreground hover:text-red-400">Remove</button>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>

                            <GlassCard>
                                <h3 className="text-lg font-bold mb-4">Invite Member</h3>
                                <InviteForm onInvite={handleInvite} />
                            </GlassCard>
                        </div>
                    )}

                    {activeTab === 'policy' && policy && (
                        <GlassCard className="max-w-2xl">
                            <div className="flex items-center gap-2 mb-6 text-success">
                                <Shield className="w-5 h-5" />
                                <h3 className="text-lg font-bold text-foreground">Governance Rules</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-foreground">Require Approval</p>
                                        <p className="text-sm text-muted-foreground">Campaigns must be approved by admin before running</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={policy.requiresApprovalForCampaign}
                                        onChange={(e) => setPolicy({ ...policy, requiresApprovalForCampaign: e.target.checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Max Daily Actions (per user)</label>
                                    <Input
                                        type="number"
                                        value={policy.maxDailyActions}
                                        onChange={(e) => setPolicy({ ...policy, maxDailyActions: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 border-t border-border text-right">
                                    <PrimaryButton onClick={handlePolicyUpdate}>Save Policies</PrimaryButton>
                                </div>
                            </div>
                        </GlassCard>
                    )}
                </>
            )}
        </div>
    );
}

function InviteForm({ onInvite }: { onInvite: (email: string, role: string) => void }) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Email Address</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" />
            </div>
            <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Role</label>
                <select
                    className="w-full bg-background border border-input rounded-lg p-2 text-sm text-foreground outline-none"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                </select>
            </div>
            <PrimaryButton className="w-full justify-center" onClick={() => onInvite(email, role)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Send Invite
            </PrimaryButton>
        </div>
    );
}
