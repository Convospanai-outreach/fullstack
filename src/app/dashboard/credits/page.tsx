"use client";

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import SectionTitle from '@/components/SectionTitle';
import GlassCard from '@/components/GlassCard';
import CreditTopupModal from '@/components/billing/CreditTopupModal';
import { Zap } from 'lucide-react';

export default function CreditsPage() {
    const { data: session } = useSession();
    const [showTopup, setShowTopup] = useState(false);

    // Mock credits for display if session is missing (real app would fetch fresh user data)
    // NOTE: In next-auth, session updates might lag, usually would fetch /api/me for fresh balance
    const credits = (session?.user as any)?.credits || 0;

    return (
        <div className="p-8">
            <SectionTitle title="Credits & Billing" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <GlassCard title="Current Balance">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                                {credits}
                            </span>
                            <span className="ml-2 text-gray-400">credits available</span>
                        </div>
                        <button
                            onClick={() => setShowTopup(true)}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <Zap className="w-4 h-4 text-yellow-400" /> Top Up
                        </button>
                    </div>
                </GlassCard>

                <GlassCard title="Usage History">
                    <p className="text-gray-400 text-sm">Recent credit usage will appear here.</p>
                </GlassCard>
            </div>

            <CreditTopupModal isOpen={showTopup} onClose={() => setShowTopup(false)} />
        </div>
    );
}
