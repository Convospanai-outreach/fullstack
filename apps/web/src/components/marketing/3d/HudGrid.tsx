"use client";

import { useMemo, useCallback } from "react";

export interface HudRailItem {
  id: string;
  label: string;
  shortLabel?: string;
}

interface HudGridProps {
  stage: string;
  depthPercent: number;
  railCount?: number;
  activeRailIndex: number;
  items?: HudRailItem[];
  compact?: boolean;
  onSelectStage?: (index: number, id: string) => void;
}

const DEFAULT_ITEMS: HudRailItem[] = [
  { id: "intake",   label: "Market Noise",           shortLabel: "INTAKE"   },
  { id: "leak",     label: "Lost Speed",              shortLabel: "LEAK"     },
  { id: "shift",    label: "Governed Funnel",         shortLabel: "SHIFT"    },
  { id: "signal",   label: "NetJana Buyer Signals",   shortLabel: "SIGNAL"   },
  { id: "outreach", label: "CMF Core AI Outreach",    shortLabel: "OUTREACH" },
  { id: "human",    label: "Human Conversion Moat",   shortLabel: "HUMAN"    },
  { id: "edge",     label: "Covospan EDGE",           shortLabel: "EDGE"     },
  { id: "revenue",  label: "Qualified Revenue",       shortLabel: "REVENUE"  },
  { id: "launch",   label: "Pilot Intake",            shortLabel: "LAUNCH"   },
];

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatDepth(value: number) {
  return String(Math.round(clampPercent(value))).padStart(3, "0");
}

export default function HudGrid({
  stage,
  depthPercent,
  railCount,
  activeRailIndex,
  items,
  compact = false,
  onSelectStage,
}: HudGridProps) {
  const railItems = useMemo(() => {
    if (items?.length) return items;
    if (railCount && railCount > 0) {
      return Array.from({ length: railCount }, (_, index) => DEFAULT_ITEMS[index] ?? {
        id: `stage-${index}`,
        label: `Stage ${index + 1}`,
        shortLabel: String(index + 1).padStart(2, "0"),
      });
    }
    return DEFAULT_ITEMS;
  }, [items, railCount]);

  const boundedActiveIndex = Math.max(0, Math.min(activeRailIndex, railItems.length - 1));
  const activeItem = railItems[boundedActiveIndex];
  const safeStage = stage || activeItem?.shortLabel || "STANDBY";
  const progress = clampPercent(depthPercent);

  const handleStageClick = useCallback((index: number, id: string) => {
    if (onSelectStage) {
      onSelectStage(index, id);
      return;
    }
    const targetEl = document.getElementById(`act-${id}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth" });
    }
  }, [onSelectStage]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 font-mono">
      {/* ── Sci-Fi Precision Corner Reticles ───────────────────────────────── */}
      <div className="absolute left-[20px] top-[20px] h-[32px] w-[32px] border-l-2 border-t-2 border-cyan-400/40" />
      <div className="absolute right-[20px] top-[20px] h-[32px] w-[32px] border-r-2 border-t-2 border-cyan-400/40" />
      <div className="absolute bottom-[20px] left-[20px] h-[32px] w-[32px] border-b-2 border-l-2 border-cyan-400/40" />
      <div className="absolute bottom-[20px] right-[20px] h-[32px] w-[32px] border-b-2 border-r-2 border-cyan-400/40" />

      {/* Subtle Holographic Grid Overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Soft Laser Scan Line */}
      <div className="fixed left-0 right-0 top-0 h-[1.5px] animate-[cmfScan_8s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-40 motion-reduce:animate-none" />

      {/* ── Top-Left System Status Badge ───────────────────────────────────── */}
      {!compact && (
        <div className="absolute left-[36px] top-[34px] hidden items-center gap-3 rounded-full border border-cyan-300/20 bg-slate-950/60 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-cyan-100/80 backdrop-blur-xl shadow-[0_0_20px_rgba(56,189,248,0.15)] sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          CraftMyFunnel AI {"//"} Quantum Fluid Engine
        </div>
      )}

      {/* ── Bottom-Left Telemetry Cockpit ──────────────────────────────────── */}
      <div className="absolute bottom-[36px] left-[36px] max-w-[calc(100vw-80px)] rounded-2xl border border-cyan-400/25 bg-slate-950/75 px-4 py-3.5 text-[10px] tracking-[0.18em] text-cyan-200/80 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] sm:text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">DEPTH:</span>
          <b className="font-semibold text-cyan-300 text-xs">{formatDepth(progress)}%</b>
          <span className="text-slate-600">{"//"}</span>
          <span className="text-slate-400">STAGE:</span>
          <b className="font-semibold text-white text-xs">{safeStage}</b>
        </div>
        {!compact && activeItem?.label && (
          <div className="mt-1 hidden max-w-[360px] truncate text-[9px] uppercase tracking-[0.16em] text-slate-400 sm:block">
            ACTIVE NODE: <span className="text-cyan-200 font-bold">{activeItem.label}</span>
          </div>
        )}
        <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-amber-400 transition-[width] duration-300 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Right-Side Interactive Process Rail ────────────────────────────── */}
      <div className="absolute right-[28px] top-1/2 hidden -translate-y-1/2 flex-col items-end gap-[11px] md:flex pointer-events-auto">
        {railItems.map((item, index) => {
          const isActive = index === boundedActiveIndex;
          const isPast = index < boundedActiveIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleStageClick(index, item.id)}
              className="group relative flex items-center justify-end gap-3 cursor-pointer outline-none transition-all"
              title={`Jump to ${item.label}`}
            >
              {/* Hover/Active Label Tooltip */}
              <span
                className={
                  "whitespace-nowrap rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.2em] backdrop-blur-xl transition-all duration-300 " +
                  (isActive
                    ? "border-cyan-400/40 bg-slate-950/80 text-cyan-200 opacity-100 shadow-[0_0_15px_rgba(56,189,248,0.25)] translate-x-0"
                    : "border-transparent bg-transparent text-slate-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-90 group-hover:border-white/10 group-hover:bg-slate-950/60")
                }
              >
                {item.shortLabel ?? item.label}
              </span>

              {/* Glowing Rail Indicator Line */}
              <div
                className="w-[3px] rounded-full transition-all duration-300"
                style={{
                  height: isActive ? 38 : isPast ? 22 : 16,
                  background: isActive
                    ? "linear-gradient(180deg, #38bdf8, #818cf8, #fbbf24)"
                    : isPast
                      ? "rgba(56,189,248,0.5)"
                      : "rgba(148,163,184,0.2)",
                  boxShadow: isActive ? "0 0 16px rgba(56,189,248,0.6)" : "none",
                }}
              />
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes cmfScan {
          0% {
            transform: translateY(0vh);
          }
          100% {
            transform: translateY(100vh);
          }
        }
      `}</style>
    </div>
  );
}
