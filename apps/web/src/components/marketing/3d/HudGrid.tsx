"use client";

import { useMemo } from "react";

export interface HudRailItem {
  id: string;
  label: string;
  shortLabel?: string;
}

interface HudGridProps {
  /** Current act/stage label, for example SIGNAL, OUTREACH, CONVERSION, SOVEREIGN. */
  stage: string;
  /** Scroll depth as 0..100. */
  depthPercent: number;
  /** Backward-compatible fallback when `items` is not provided. */
  railCount?: number;
  /** Active stage index. */
  activeRailIndex: number;
  /** Optional named rail items for the process-led funnel narrative. */
  items?: HudRailItem[];
  /** Optional compact mode for mobile or embedded previews. */
  compact?: boolean;
}

const DEFAULT_ITEMS: HudRailItem[] = [
  { id: "intake",   label: "Market Noise",           shortLabel: "INTAKE"   },
  { id: "leak",     label: "Lost Speed",              shortLabel: "LEAK"     },
  { id: "shift",    label: "Governed Funnel",         shortLabel: "SHIFT"    },
  { id: "signal",   label: "NetJana",                 shortLabel: "SIGNAL"   },
  { id: "outreach", label: "CMF Core",                shortLabel: "OUTREACH" },
  { id: "human",    label: "Human Layer",             shortLabel: "HUMAN"    },
  { id: "edge",     label: "Covospan EDGE",           shortLabel: "EDGE"     },
  { id: "revenue",  label: "Qualified Revenue",       shortLabel: "REVENUE"  },
  { id: "launch",   label: "Pilot CTA",               shortLabel: "LAUNCH"   },
];

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatDepth(value: number) {
  return String(Math.round(clampPercent(value))).padStart(3, "0");
}

/**
 * Fixed operating-system chrome for the CraftMyFunnel cinematic funnel.
 *
 * The component is intentionally DOM-only and pointer-events disabled. It is
 * driven by section-level React state from `CinematicHome`, not per-frame R3F
 * state, so it remains cheap while the Canvas animates behind it.
 */
export default function HudGrid({
  stage,
  depthPercent,
  railCount,
  activeRailIndex,
  items,
  compact = false,
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

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 font-mono">
      {/* Corner brackets */}
      <div className="absolute left-[18px] top-[18px] h-[26px] w-[26px] border-l border-t border-cyan-300/35" />
      <div className="absolute right-[18px] top-[18px] h-[26px] w-[26px] border-r border-t border-cyan-300/35" />
      <div className="absolute bottom-[18px] left-[18px] h-[26px] w-[26px] border-b border-l border-cyan-300/35" />
      <div className="absolute bottom-[18px] right-[18px] h-[26px] w-[26px] border-b border-r border-cyan-300/35" />

      {/* Soft scan line */}
      <div className="fixed left-0 right-0 top-0 h-px animate-[cmfScan_7s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent opacity-25 motion-reduce:animate-none" />

      {/* Top-left system label */}
      {!compact && (
        <div className="absolute left-[30px] top-[30px] hidden rounded-full border border-cyan-300/15 bg-slate-950/30 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-cyan-100/70 backdrop-blur-md sm:block">
          CraftMyFunnel // Fluid Funnel Engine
        </div>
      )}

      {/* Bottom-left readout */}
      <div className="absolute bottom-[34px] left-[30px] max-w-[calc(100vw-80px)] rounded-2xl border border-cyan-300/10 bg-slate-950/25 px-3.5 py-3 text-[10px] tracking-[0.18em] text-cyan-200/70 backdrop-blur-md sm:text-[11px]">
        <div>
          DEPTH <b className="font-semibold text-slate-50">{formatDepth(progress)}</b>
          <span className="text-slate-500"> // </span>
          STAGE <b className="font-semibold text-slate-50">{safeStage}</b>
        </div>
        {!compact && activeItem?.label && (
          <div className="mt-1 hidden max-w-[360px] truncate text-[9px] uppercase tracking-[0.16em] text-slate-400 sm:block">
            PROCESS NODE: <span className="text-cyan-100/80">{activeItem.label}</span>
          </div>
        )}
        <div className="mt-2 h-px w-full overflow-hidden rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Right-side process rail */}
      <div className="absolute right-[26px] top-1/2 hidden -translate-y-1/2 flex-col items-center gap-[13px] md:flex">
        {railItems.map((item, index) => {
          const isActive = index === boundedActiveIndex;
          const isPast = index < boundedActiveIndex;
          return (
            <div key={item.id} className="group relative flex items-center gap-3">
              <div
                className="w-[2px] rounded-full transition-all duration-300"
                style={{
                  height: isActive ? 34 : isPast ? 24 : 20,
                  background: isActive
                    ? "linear-gradient(180deg, #22d3ee, #a855f7)"
                    : isPast
                      ? "rgba(34,211,238,0.42)"
                      : "rgba(148,163,184,0.2)",
                  boxShadow: isActive ? "0 0 18px rgba(34,211,238,0.45)" : "none",
                }}
              />
              <div
                className={
                  "absolute right-[14px] whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] backdrop-blur-md transition-all duration-300 " +
                  (isActive
                    ? "translate-x-0 border-cyan-300/30 bg-slate-950/50 text-cyan-100 opacity-100"
                    : "translate-x-2 border-transparent bg-transparent text-slate-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-80")
                }
              >
                {item.shortLabel ?? item.label}
              </div>
            </div>
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
