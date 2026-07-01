"use client";

import { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
    Copy,
    Terminal,
    Database,
    Shield,
    Zap,
    Book
} from 'lucide-react';
import { toast } from 'sonner';

const ENDPOINTS = [
    {
        category: "Leads",
        method: "GET",
        path: process.env['NEXT_PUBLIC_API_URL'] + "/v1/leads",
        description: "Fetch a list of leads with advanced filtering and pagination support.",
        params: [
            { name: "limit", type: "number", desc: "Max results (default 10, max 100)" },
            { name: "offset", type: "number", desc: "Pagination offset" },
            { name: "status", type: "string", desc: "Filter by status (NEW, QUALIFIED, WON, etc)" },
            { name: "q", type: "string", desc: "Search across name, email, or company" }
        ],
        example: `curl -H "X-API-KEY: your_key" \\
"https://www.craftmyfunnel.live/api/v1/leads?limit=5&status=QUALIFIED"`
    },
    {
        category: "Leads",
        method: "POST",
        path: process.env['NEXT_PUBLIC_API_URL'] + "/v1/leads",
        description: "Create a new lead and optionally assign to a campaign.",
        example: `curl -X POST -H "X-API-KEY: your_key" \\
-H "Content-Type: application/json" \\
-d '{"email": "john@example.com", "fullName": "John Doe", "dealValue": 5000}' \\
"https://www.craftmyfunnel.live/api/v1/leads"`
    },
    {
        category: "Knowledge",
        method: "GET",
        path: process.env['NEXT_PUBLIC_API_URL'] + "/v1/knowledge/search",
        description: "Contextual search across your knowledge base collections using RAG logic.",
        params: [
            { name: "q", type: "string", desc: "The natural language query" },
            { name: "limit", type: "number", desc: "Number of snippets to return" }
        ],
        example: `curl -H "X-API-KEY: your_key" \\
"https://www.craftmyfunnel.live/api/v1/knowledge/search?q=pricing+plans"`
    },
    {
        category: "Workflows",
        method: "POST",
        path: process.env['NEXT_PUBLIC_API_URL'] + "/v1/workflows/{id}/run",
        description: "Programmatically trigger a workflow execution for a specific lead or entity.",
        example: `curl -X POST -H "X-API-KEY: your_key" \\
-d '{"leadId": "lead_123"}' \\
"https://www.craftmyfunnel.live/api/v1/workflows/wf_xyz/run"`
    },
    {
        category: "Tasks",
        method: "GET",
        path: process.env['NEXT_PUBLIC_API_URL'] + "/v1/tasks",
        description: "Retrieve a list of pending and completed tasks for your team.",
        params: [
            { name: "status", type: "string", desc: "Filter by status (TODO, DONE)" },
            { name: "priority", type: "string", desc: "Filter by priority (HIGH, MEDIUM, LOW)" }
        ],
        example: `curl -H "X-API-KEY: your_key" \\
"https://www.craftmyfunnel.live/api/v1/tasks?priority=HIGH"`
    }
];

export default function ApiDocsPage() {
    const defaultEndpoint = ENDPOINTS[0]!;
    const [selectedEndpoint, setSelectedEndpoint] = useState(defaultEndpoint);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const categories = Array.from(new Set(ENDPOINTS.map(e => e.category)));

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
            <SectionHeader
                title="Developer Hub"
                subtitle="The complete guide to integrating CraftMyFunnel into your stack."
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-3xl border border-white/5 bg-slate-950/50 backdrop-blur-xl">
                {/* Navigation - Column 1 */}
                <div className="lg:col-span-3 border-r border-white/5 p-6 bg-black/20">
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Guides</h3>
                            <div className="space-y-1">
                                <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 flex items-center gap-2">
                                    <Book className="w-3.5 h-3.5" /> Introduction
                                </button>
                                <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" /> Authentication
                                </button>
                                <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5" /> Webhooks
                                </button>
                            </div>
                        </div>

                        {categories.map(cat => (
                            <div key={cat}>
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">{cat}</h3>
                                <div className="space-y-1">
                                    {ENDPOINTS.filter(e => e.category === cat).map(ep => (
                                        <button
                                            key={ep.path + ep.method}
                                            onClick={() => setSelectedEndpoint(ep)}
                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method
                                                ? "bg-white/10 text-white border border-white/10"
                                                : "text-gray-500 hover:text-gray-300"
                                                }`}
                                        >
                                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                {ep.method}
                                            </span>
                                            <span className="text-[11px] font-mono truncate">{ep.path.split('/v1')[1]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content - Column 2 */}
                <div className="lg:col-span-12 xl:col-span-5 p-8 overflow-y-auto">
                    <div className="max-w-2xl space-y-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${selectedEndpoint.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                    }`}>
                                    {selectedEndpoint.method}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{selectedEndpoint.category}</span>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">{selectedEndpoint.path}</h2>
                            <p className="text-gray-400 leading-relaxed">{selectedEndpoint.description}</p>
                        </div>

                        {selectedEndpoint.params && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-400" /> Parameters
                                </h3>
                                <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
                                    {selectedEndpoint.params.map(p => (
                                        <div key={p.name} className="p-4 flex gap-6">
                                            <div className="w-24 shrink-0">
                                                <code className="text-blue-400 text-xs font-mono">{p.name}</code>
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">{p.type}</div>
                                                <div className="text-xs text-gray-400">{p.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-8 border-t border-white/5">
                            <h3 className="text-sm font-bold text-white mb-4">Responses</h3>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> 200 OK
                                </span>
                                <span className="text-gray-500">Success</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Code - Column 3 */}
                <div className="hidden xl:block xl:col-span-4 bg-slate-900/50 p-6 border-l border-white/5">
                    <div className="sticky top-6 space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                <Terminal className="w-3.5 h-3.5 text-blue-400" /> Request Example
                            </div>
                            <button
                                onClick={() => copyToClipboard(selectedEndpoint.example)}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-white"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                            <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                                <span className="text-[10px] text-gray-500 font-mono ml-2 uppercase">curl</span>
                            </div>
                            <pre className="p-6 text-xs font-mono text-blue-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                {selectedEndpoint.example}
                            </pre>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-white/5">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Best Practices</h4>
                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                                    <Shield className="w-3 h-3" /> Security Note
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    Never share your API keys in client-side code. Always trigger requests from a secure backend environment.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
