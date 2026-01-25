import { GovernanceDashboard } from '@/components/governance/GovernanceDashboard';
import { Suspense } from 'react';

async function getGovernanceData() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/governance`, {
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error('Failed to fetch governance data');
    }

    return res.json();
}

export default async function GovernancePage() {
    const data = await getGovernanceData();

    return (
        <div className="min-h-screen bg-background">
            <Suspense fallback={<div className="p-6">Loading...</div>}>
                <GovernanceDashboard
                    experiments={data.experiments}
                    datasets={data.datasets}
                />
            </Suspense>
        </div>
    );
}
