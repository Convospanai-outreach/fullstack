"use client";

import { useState, useEffect } from 'react';
import { setComplianceMode } from '@/app/actions/hardware';
import ComplianceLog from './ComplianceLog';
import EdgeNodeStatus from './EdgeNodeStatus';

export default function ComplianceSettings() {
    const [region, setRegion] = useState<'INDIA' | 'EU'>('INDIA');
    const [hybridCompute, setHybridCompute] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(true);
    const [, setSaving] = useState(false);

    useEffect(() => {
        const savedRegion = localStorage.getItem('CRAFTMYFUNNEL_REGION') as 'INDIA' | 'EU';
        if (savedRegion) setRegion(savedRegion);

        const savedHybrid = localStorage.getItem('CRAFTMYFUNNEL_HYBRID') === 'true';
        setHybridCompute(savedHybrid);
    }, []);

    const toggleRegion = async () => {
        setSaving(true);
        const newRegion = region === 'INDIA' ? 'EU' : 'INDIA';
        await new Promise(resolve => setTimeout(resolve, 500));

        // Enforce on Physical Edge Node (via Server Action)
        await setComplianceMode(newRegion);

        localStorage.setItem('CRAFTMYFUNNEL_REGION', newRegion);
        setRegion(newRegion);
        setSaving(false);
    };

    const toggleHybrid = () => {
        const newValue = !hybridCompute;
        setHybridCompute(newValue);
        localStorage.setItem('CRAFTMYFUNNEL_HYBRID', String(newValue));
    };

    const handleUpdate = () => {
        alert("Downloading Update Package... Please confirm installation on the physical device screen.");
        setUpdateAvailable(false);
    };

    return (
        <div className="p-6 bg-background text-foreground rounded-lg border border-border space-y-8">
            {/* LEGAL FIX: Rebranding */}
            <div className="border-b border-border pb-4">
                <h2 className="text-xl font-bold mb-2">Compliance Guardrails</h2>
                <div className="bg-warning/20 border border-warning/30 p-3 rounded text-sm text-warning">
                    <strong>Disclaimer:</strong> This tool acts as a data processor. The user retains full responsibility as the Data Fiduciary/Controller. This device does not replace a legal DPO.
                </div>
            </div>

            {/* EDGE NODE STATUS */}
            <EdgeNodeStatus />

            {/* REGION SETTINGS */}
            <div className="flex items-center justify-between p-4 bg-card rounded">
                <div>
                    <h3 className="font-semibold text-lg">Active Region</h3>
                    <p className="text-muted-foreground text-sm">Target Jurisdiction for PII Redaction.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${region === 'INDIA' ? 'text-success' : 'text-muted-foreground'}`}>INDIA</span>
                    <button
                        onClick={toggleRegion}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${region === 'EU' ? 'bg-primary' : 'bg-success'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${region === 'EU' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-bold ${region === 'EU' ? 'text-primary' : 'text-muted-foreground'}`}>EU</span>
                </div>
            </div>

            {/* COMMERCIAL FIX: Hybrid Compute */}
            <div className="flex items-center justify-between p-4 bg-card rounded">
                <div>
                    <h3 className="font-semibold text-lg">Hybrid Compute Offload</h3>
                    <p className="text-muted-foreground text-sm">
                        Offload heavy vectorization to Private Cloud to extend hardware lifespan.
                        PII is always masked locally first.
                    </p>
                </div>
                <button
                    onClick={toggleHybrid}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hybridCompute ? 'bg-primary' : 'bg-secondary'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${hybridCompute ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* TRUST FIX: Transparent Updates */}
            <div className="p-4 bg-card rounded">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg">Firmware Management</h3>
                    {updateAvailable ? (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Update Available</span>
                    ) : (
                        <span className="text-xs bg-success text-primary-foreground px-2 py-1 rounded-full">Up to Date</span>
                    )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                    Updates are downloaded but never installed automatically. You must manually approve installation to maintain the air gap integrity.
                </p>
                {updateAvailable && (
                    <button
                        onClick={handleUpdate}
                        className="bg-primary hover:bg-primary text-primary-foreground text-sm px-4 py-2 rounded"
                    >
                        Review & Install Patch (v2.1.0)
                    </button>
                )}
            </div>

            {/* AUDIT LOG */}
            <ComplianceLog />
        </div>
    );
}
