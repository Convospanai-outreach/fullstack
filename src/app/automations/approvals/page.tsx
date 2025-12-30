"use client";



export default function ApprovalsPage() {
    // Mock data for now, would fetch /api/automations/logs?status=pending_approval
    const pendingItems = [
        { id: "1", trigger: "lead.replied", action: "email.reply", context: { message: "Interested in pricing" }, cost: 0.00045, createdAt: new Date().toISOString() }
    ];

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Approval Queue</h1>
                    <p className="text-gray-400">Review Actions before they execute (AI Safety)</p>
                </div>
            </div>

            <div className="space-y-4">
                {pendingItems.map(item => (
                    <div key={item.id} className="glass p-6 rounded-xl border border-white/10 flex justify-between items-start">
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs uppercase border border-blue-500/20">{item.trigger}</span>
                                <span className="text-gray-500">→</span>
                                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs uppercase border border-purple-500/20">{item.action}</span>
                            </div>
                            <p className="text-white font-medium">AI generated a reply draft</p>
                            <p className="text-sm text-gray-500 mt-1">Context: "{item.context.message}"</p>
                            <div className="mt-2 text-xs text-yellow-500">Est. Cost: ${item.cost}</div>
                        </div>
                        <div className="flex space-x-2">
                            <button className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20">Reject</button>
                            <button className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600">Approve & Run</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
