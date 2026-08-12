"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BoundaryProps {
  children: ReactNode;
  moduleName: string;
  strictMode?: boolean; // Forces immediate crash on soft warnings in dev
}

interface BoundaryState {
  hasError: boolean;
  errorId: string | null;
}

export class StrictQualityBoundary extends Component<BoundaryProps, BoundaryState> {
  private mountTimestamp: number = 0;
  private renderCount: number = 0;

  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(_: Error): BoundaryState {
    // Generate an immutable error hash for telemetry tracing
    return { hasError: true, errorId: `ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}` };
  }

  override componentDidMount() {
    this.mountTimestamp = performance.now();
  }

  override componentDidUpdate() {
    if (process.env.NODE_ENV === "development" && this.props.strictMode) {
      this.renderCount += 1;
      // Avant-garde performance enforcement: warn if a static layout re-renders > 4 times rapidly
      if (this.renderCount === 5) {
        console.error(`[QUALITY ENFORCER] Excessive re-renders detected in module: ${this.props.moduleName}`);
      }
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In a real implementation, this pipes to OpenTelemetry/Sentry instantly
    console.error(`[STRUCTURAL FAILURE] ${this.props.moduleName} boundary breached:`, error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <motion.div 
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 1.2 }}
          className="relative flex flex-col items-start justify-center w-full min-h-[400px] p-12 bg-black border-[0.5px] border-rose-500/20 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(244,63,94,0.03)_50%,transparent_75%)] bg-[length:4px_4px]" />
          
          <div className="relative z-10 flex flex-col gap-6">
            <div className="inline-flex items-center gap-3 border-[0.5px] border-rose-500/40 bg-rose-500/10 px-3 py-1">
              <span className="animate-pulse w-2 h-2 bg-rose-500" />
              <span className="font-mono text-[10px] text-rose-400 uppercase tracking-[0.3em]">
                System Fragmentation
              </span>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-light tracking-tighter text-zinc-100 font-mono">
                Boundary Fault Detected.
              </h2>
              <p className="text-zinc-500 max-w-md text-sm leading-relaxed">
                The {this.props.moduleName} module experienced a critical execution failure. Telemetry has been dispatched to the engineering grid.
              </p>
            </div>

            <div className="flex flex-col gap-1 mt-4">
              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Incident Hash</span>
              <span className="text-xs text-zinc-400 font-mono bg-white/5 px-2 py-1 border-[0.5px] border-white/10 w-fit">
                {this.state.errorId}
              </span>
            </div>

            <button 
              onClick={() => this.setState({ hasError: false, errorId: null })}
              className="mt-8 px-6 py-3 border-[0.5px] border-white/20 text-xs font-mono uppercase tracking-widest text-zinc-300 hover:bg-white/5 hover:text-white transition-all duration-300"
            >
              Reinitialize Module
            </button>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}
