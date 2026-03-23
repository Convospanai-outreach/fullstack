"use client";

export default function AgentFeed({ activities }: any) {
    return (
        <div className="flex flex-col gap-3 max-h-64 overflow-auto pr-2">
            {activities.map((a: any, idx: number) => (
                <div key={idx} className="flex gap-3 items-start">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-400 flex items-center justify-center text-white">
                        {a.agent.charAt(0)}
                    </div>
                    <div className="flex-1 text-sm">
                        <div className="text-gray-100"><strong>{a.agent}</strong> {a.action}</div>
                        <div className="text-xs text-gray-400">{a.time}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
