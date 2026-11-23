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
        <div className="p-4 bg-card rounded">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-lg">Edge Node (Sovereign Wall)</h3>
                    <p className="text-muted-foreground text-sm">Connection status for your local PII-masking hardware.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${checking ? 'bg-muted' : connected ? 'bg-success' : 'bg-destructive'}`} />
                    <span className={`text-sm font-bold ${checking ? 'text-muted-foreground' : connected ? 'text-success' : 'text-destructive'}`}>
                        {checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {!checking && status && (
                <div className="mt-3 text-xs text-muted-foreground space-y-1 font-mono">
                    {status.hardwareId && <div>Hardware ID: {status.hardwareId}</div>}
                    {status.signatureMatch === false && (
                        <div className="text-destructive">Signature mismatch - possible rogue device</div>
                    )}
                    {status.latencyMs !== undefined && <div>Latency: {status.latencyMs}ms</div>}
                    {status.error && <div className="text-destructive">{status.error}</div>}
                    {!connected && !status.error && <div>No response from edge node. Check that it is powered on and reachable.</div>}
                </div>
            )}
        </div>
    );
}
