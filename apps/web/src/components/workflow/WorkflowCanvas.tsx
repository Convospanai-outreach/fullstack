"use client";

import { WorkflowNode } from "./WorkflowNode";

export function WorkflowCanvas() {
    return (
        <div className="relative w-full h-[600px] bg-black/20 rounded-xl border border-white/10 overflow-hidden bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                    d="M 350 130 C 450 130, 450 280, 550 280"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2"
                    fill="none"
                />
                <path
                    d="M 350 130 C 450 130, 450 430, 550 430"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2"
                    fill="none"
                />
            </svg>

            <WorkflowNode title="New Lead Detected" type="trigger" x={100} y={100} />
            <WorkflowNode title="Enrich Profile" type="action" x={550} y={250} />
            <WorkflowNode title="Check Company Size" type="condition" x={550} y={400} />
        </div>
    );
}
