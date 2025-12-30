"use client";

import Link from "next/link";

export default function AutomationsPage() {
    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Automations</h1>
                    <p className="text-gray-400">Manage your event-based workflows</p>
                </div>
                <div className="flex space-x-3">
                    <Link href="/automations/approvals" className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors">
                        Approvals Queue
                    </Link>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        New Automation
                    </button>
                </div>
            </div>

            {/* Placeholder List */}
            <div className="glass border border-white/10 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center mb-4">
                    <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-lg font-medium text-white">No active automations</h3>
                <p className="text-gray-400 mt-2 max-w-md mx-auto">
                    Create rules like "When a lead replies, stop the campaign" or "When email opens, tag as Warm".
                </p>
            </div>

            {/* TODO: Add List Component mapping over data */}
        </div>
    );
}
