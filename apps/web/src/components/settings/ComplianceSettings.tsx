"use client";

import { useState, useEffect } from 'react';
import { setComplianceMode } from '@/app/actions/hardware';
import ComplianceLog from './ComplianceLog';

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
        <div className="p-6 bg-gray-900 text-white rounded-lg border border-gray-700 space-y-8">
            {/* LEGAL FIX: Rebranding */}
            <div className="border-b border-gray-700 pb-4">
                <h2 className="text-xl font-bold mb-2">Compliance Guardrails</h2>
                <div className="bg-yellow-900/20 border border-yellow-700 p-3 rounded text-sm text-yellow-200">
                    <strong>Disclaimer:</strong> This tool acts as a data processor. The user retains full responsibility as the Data Fiduciary/Controller. This device does not replace a legal DPO.
                </div>
            </div>

            {/* REGION SETTINGS */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                <div>
                    <h3 className="font-semibold text-lg">Active Region</h3>
                    <p className="text-gray-400 text-sm">Target Jurisdiction for PII Redaction.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${region === 'INDIA' ? 'text-green-400' : 'text-gray-500'}`}>INDIA</span>
                    <button
                        onClick={toggleRegion}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${region === 'EU' ? 'bg-blue-600' : 'bg-green-600'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${region === 'EU' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-bold ${region === 'EU' ? 'text-blue-400' : 'text-gray-500'}`}>EU</span>
                </div>
            </div>

            {/* COMMERCIAL FIX: Hybrid Compute */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                <div>
                    <h3 className="font-semibold text-lg">Hybrid Compute Offload</h3>
                    <p className="text-gray-400 text-sm">
                        Offload heavy vectorization to Private Cloud to extend hardware lifespan.
                        PII is always masked locally first.
                    </p>
                </div>
                <button
                    onClick={toggleHybrid}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hybridCompute ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hybridCompute ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* TRUST FIX: Transparent Updates */}
            <div className="p-4 bg-gray-800 rounded">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg">Firmware Management</h3>
                    {updateAvailable ? (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">Update Available</span>
                    ) : (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">Up to Date</span>
                    )}
                </div>
                <p className="text-gray-400 text-sm mb-4">
                    Updates are downloaded but never installed automatically. You must manually approve installation to maintain the air gap integrity.
                </p>
                {updateAvailable && (
                    <button
                        onClick={handleUpdate}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded"
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
