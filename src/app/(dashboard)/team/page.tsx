"use client";

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Input } from '@/components/ui/Input';
import { Loader2, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';

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
                fetch('/api/team/members'),
                fetch('/api/team/policy')
            ]);
            setMembers(await membersRes.json());
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
            const res = await fetch('/api/team/members', {
                method: 'POST',
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
            await fetch('/api/team/policy', {
                method: 'PATCH',
                body: JSON.stringify(policy)
            });
            toast.dismiss(toastId);
            toast.success("Policy updated");
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Failed to update");
        }
    };

    return (
        <AppShell>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-text-primary">Team Governance</h1>
                <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'members' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-white'}`}
                    >
                        Members
                    </button>
                    <button
                        onClick={() => setActiveTab('policy')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'policy' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-white'}`}
                    >
                        Policies
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-accent-blue" /></div>
            ) : (
                <>
                    {activeTab === 'members' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <GlassCard className="lg:col-span-2">
                                <h3 className="text-lg font-bold mb-4">Active Members</h3>
                                <div className="space-y-4">
                                    {members.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent-violet/20 flex items-center justify-center text-accent-violet font-bold">
                                                    {m.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-text-primary">{m.email}</div>
                                                    <div className="text-xs text-text-secondary capitalize">{m.role} • {m.status}</div>
                                                </div>
                                            </div>
                                            <button className="text-xs text-text-muted hover:text-red-400">Remove</button>
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
                            <div className="flex items-center gap-2 mb-6 text-accent-mint">
                                <Shield className="w-5 h-5" />
                                <h3 className="text-lg font-bold text-text-primary">Governance Rules</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-text-primary">Require Approval</p>
                                        <p className="text-sm text-text-secondary">Campaigns must be approved by admin before running</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={policy.requiresApprovalForCampaign}
                                        onChange={(e) => setPolicy({ ...policy, requiresApprovalForCampaign: e.target.checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary">Max Daily Actions (per user)</label>
                                    <Input
                                        type="number"
                                        value={policy.maxDailyActions}
                                        onChange={(e) => setPolicy({ ...policy, maxDailyActions: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 border-t border-white/10 text-right">
                                    <PrimaryButton onClick={handlePolicyUpdate}>Save Policies</PrimaryButton>
                                </div>
                            </div>
                        </GlassCard>
                    )}
                </>
            )}
        </AppShell>
    );
}

function InviteForm({ onInvite }: { onInvite: (email: string, role: string) => void }) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">Email Address</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" />
            </div>
            <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">Role</label>
                <select
                    className="w-full bg-bg-base/50 border border-border-subtle rounded-lg p-2 text-sm text-text-primary outline-none"
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
