"use client";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function AgentControl({ agents }: any) {
    const { mutate } = useSWR(getBrowserApiBase() + "/orchestrator/agents");
    async function run(id: string) {
        await fetcher(`${getBrowserApiBase()}/orchestrator/agents/${id}/run`, { method: "POST" });
        mutate();
    }
    async function stop(id: string) {
        await fetcher(`${getBrowserApiBase()}/orchestrator/agents/${id}/stop`, { method: "POST" });
        mutate();
    }

    if (!agents || agents.length === 0) return <div className="text-sm text-muted-foreground">No agents found</div>;

    return (
        <div className="flex flex-col gap-3">
            {agents.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between">
                    <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.status}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => run(a.id)} className="px-3 py-1 rounded bg-green-500 text-white text-sm">Run</button>
                        <button onClick={() => stop(a.id)} className="px-3 py-1 rounded bg-red-500 text-white text-sm">Stop</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
