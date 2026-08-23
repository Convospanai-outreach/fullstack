"use client";

import { useEffect, useState } from 'react';
import { getEdgeNodeStatus } from '@/app/actions/hardware';

interface Status {
    connected: boolean;
    hardwareId?: string;
    signatureMatch?: boolean;
    latencyMs?: number;
    error?: string;
}

export default function EdgeNodeStatus() {
    const [status, setStatus] = useState<Status | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            const result = await getEdgeNodeStatus();
            if (!cancelled) {
                setStatus(result);
                setChecking(false);
            }
        };

        check();
        const interval = setInterval(check, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const connected = status?.connected ?? false;

    return (
        <div className="p-4 bg-gray-800 rounded">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-lg">Edge Node (Sovereign Wall)</h3>
                    <p className="text-gray-400 text-sm">Connection status for your local PII-masking hardware.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${checking ? 'bg-gray-500' : connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-sm font-bold ${checking ? 'text-gray-400' : connected ? 'text-green-400' : 'text-red-400'}`}>
                        {checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {!checking && status && (
                <div className="mt-3 text-xs text-gray-500 space-y-1 font-mono">
                    {status.hardwareId && <div>Hardware ID: {status.hardwareId}</div>}
                    {status.signatureMatch === false && (
                        <div className="text-red-400">Signature mismatch - possible rogue device</div>
                    )}
                    {status.latencyMs !== undefined && <div>Latency: {status.latencyMs}ms</div>}
                    {status.error && <div className="text-red-400">{status.error}</div>}
                    {!connected && !status.error && <div>No response from edge node. Check that it is powered on and reachable.</div>}
                </div>
            )}
        </div>
    );
}
