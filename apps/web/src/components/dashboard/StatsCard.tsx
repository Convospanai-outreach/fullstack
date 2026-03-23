"use client";

export default function StatsCard({ title, value, change, icon }: any) {
    const up = change >= 0;
    return (
        <div className="glass p-5 rounded-2xl flex items-center justify-between">
            <div>
                <div className="text-sm text-gray-300">{title}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
                <div className={`text-sm mt-2 ${up ? "text-green-400" : "text-red-400"}`}>
                    {up ? "▲" : "▼"} {Math.abs(change)}%
                </div>
            </div>
            <div className="ml-4 w-12 h-12 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 shadow-md">
                <span className="text-xl">{icon || "⚙️"}</span>
            </div>
        </div>
    );
}
