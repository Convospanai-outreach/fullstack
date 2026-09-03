"use client";

import { useState } from "react";
import {
    Cpu,
    HardDrive,
    Server,
    Wifi,
    CheckCircle2,
    RefreshCw,
    Plus,
    Radio,
    Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function EdgeRuntimePage() {
    const [devices, setDevices] = useState([
        {
            id: "edge-pi5-01",
            name: "Primary Pi5 Edge Node",
            type: "Raspberry Pi 5 (8GB)",
            status: "ONLINE",
            latency: "18ms",
            model: "Phi-3-mini-4k (Q4_K_M)",
            throughput: "24 tok/s",
            lastSeen: "Just now"
        },
        {
            id: "edge-mac-studio",
            name: "On-Premises Studio Node",
            type: "Apple M2 Max (32GB)",
            status: "STANDBY",
            latency: "8ms",
            model: "Llama-3-8B-Instruct",
            throughput: "48 tok/s",
            lastSeen: "2 mins ago"
        }
    ]);

    const [isPinging, setIsPinging] = useState(false);

    const handlePingNodes = () => {
        setIsPinging(true);
        setTimeout(() => {
            setIsPinging(false);
            toast.success("Edge Heartbeat Received", {
                description: "All enrolled edge nodes responding with &lt;20ms latency."
            });
        }, 1000);
    };

    const handleEnrollNode = () => {
        toast.info("Edge Enrollment Token Generated", {
            description: "Run: curl -sSL https://craftmyfunnel.live/edge/install.sh | bash"
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        <Radio className="w-3.5 h-3.5" />
                        Private Edge Hardware
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Edge Runtime
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Local micro-LLM inference, Raspberry Pi 5 node fleet, and offline dispatch buffers.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePingNodes}
                        disabled={isPinging}
                        className="bg-muted border-border text-foreground text-xs"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPinging ? "animate-spin" : ""}`} />
                        Ping Fleet
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleEnrollNode}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs shadow-lg shadow-cyan-600/20 gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Enroll Edge Device
                    </Button>
                </div>
            </div>

            {/* Edge Fleet Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {devices.map((device) => (
                    <div key={device.id} className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Cpu className="w-5 h-5 text-cyan-400" />
                                <div>
                                    <h2 className="text-base font-bold text-foreground">{device.name}</h2>
                                    <p className="text-xs text-muted-foreground">{device.type}</p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {device.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                            <div className="p-3 rounded-xl bg-muted border border-border/60">
                                <p className="text-muted-foreground">Local Model</p>
                                <p className="text-foreground font-medium truncate">{device.model}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted border border-border/60">
                                <p className="text-muted-foreground">Inference Speed</p>
                                <p className="text-emerald-400 font-mono font-medium">{device.throughput}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted border border-border/60">
                                <p className="text-muted-foreground">Node Latency</p>
                                <p className="text-cyan-400 font-mono font-medium">{device.latency}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted border border-border/60">
                                <p className="text-muted-foreground">Heartbeat</p>
                                <p className="text-foreground font-medium">{device.lastSeen}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Install Terminal Box */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        Quick Edge Daemon Installation (Linux / ARM64 / macOS)
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-mono">llama.cpp + FastAPI Edge</span>
                </div>
                <div className="p-4 rounded-xl bg-background border border-border font-mono text-xs text-cyan-300 select-all overflow-x-auto">
                    curl -sSL https://craftmyfunnel.live/api/edge/install.sh | bash -s -- --token=edge_tk_live_98a7bc
                </div>
            </div>
        </div>
    );
}
