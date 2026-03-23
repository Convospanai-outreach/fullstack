"use client";

import { useState } from 'react';

interface AuditLog {
    id: number;
    timestamp: string;
    action: string;
    masked_prompt: string;
    detokenized_result: string; // ONLY visible locally
}

export default function ComplianceLog() {
    const [logs] = useState<AuditLog[]>([
        {
            id: 1,
            timestamp: new Date().toISOString(),
            action: "LLM_GENERATION",
            masked_prompt: "Draft email to <ENTITY_1>...",
            detokenized_result: "Draft email to John Doe..."
        }
    ]);

    return (
        <div className="p-6 bg-gray-900 text-white rounded-lg border border-gray-700 mt-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🛡️</span> Compliance Audit Log (SafeRun™ Verified)
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 text-gray-400 text-sm">
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Action</th>
                            <th className="p-3">Masked Prompt</th>
                            <th className="p-3 text-green-400">Detokenized (Local)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="p-3 text-sm font-mono text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                <td className="p-3 text-sm">{log.action}</td>
                                <td className="p-3 text-sm text-yellow-500 font-mono">{log.masked_prompt}</td>
                                <td className="p-3 text-sm text-green-400 font-mono blur-sm hover:blur-none transition-all cursor-pointer" title="Hover to reveal">
                                    {log.detokenized_result}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
                * ConvoSpan SafeRun™: Real data is never stored on our servers. This log is generated from your local session.
            </p>
        </div>
    );
}
