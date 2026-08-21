"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface KPIData {
  meetingsBooked: number;
  meetingsDelta: number;
  activeLeads: number;
  draftsReady: number;
  draftsPendingSend: number;
  openRatePct: number;
  openRateDelta: number;
}

const transitionCurve = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.8 } as const;

function DeltaBadge({ value, unit = '' }: { value: number; unit?: string }) {
  if (value === 0) return <span className="text-zinc-600 font-mono text-[9px] uppercase tracking-widest">— N/A</span>;
  const isPos = value > 0;
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 border-[0.5px] px-1.5 py-0.5",
      isPos ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" : "border-rose-500/30 text-rose-400 bg-rose-500/5"
    )}>
      <span className="font-mono text-[8px] uppercase tracking-[0.2em]">{isPos ? 'POS' : 'NEG'}</span>
      <span className="font-mono text-[10px]">{Math.abs(value)}{unit}</span>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="relative h-32 border-[0.5px] border-white/10 bg-black overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_1.5s_infinite] transition-all" style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
  );
}

interface KPIRowProps {
  data: KPIData | null;
  loading?: boolean;
}

export function KPIRow({ data, loading }: KPIRowProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] bg-white/10 border-[0.5px] border-white/10 mb-8 p-[1px]">
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} />)}
      </div>
    );
  }

  const kpis = [
    {
      id: "meetings",
      label: "Meetings Secured",
      tooltip: "Total qualified meetings booked across active campaigns",
      value: data.meetingsBooked,
      renderDelta: () => <DeltaBadge value={data.meetingsDelta} />,
      isPrimary: true
    },
    {
      id: "leads",
      label: "Active Pipeline",
      tooltip: "Leads currently in active outreach sequences",
      value: data.activeLeads,
      href: "/leads",
      renderDelta: () => <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-widest">Live State</span>
    },
    {
      id: "drafts",
      label: "Drafts Queued",
      tooltip: "Total AI-generated drafts in review pipeline across campaigns",
      value: data.draftsReady,
      href: "/approvals",
      renderDelta: () => (
        data.draftsPendingSend > 0
          ? <span className="text-amber-500/80 font-mono text-[9px] uppercase tracking-widest border-[0.5px] border-amber-500/20 px-1.5 bg-amber-500/5">{data.draftsPendingSend} Dispatch Ready</span>
          : <span className="text-emerald-500/80 font-mono text-[9px] uppercase tracking-widest">Optimized</span>
      )
    },
    {
      id: "open_rate",
      label: "Signal Capture",
      tooltip: "Engagement and reply rate performance across outreach",
      value: `${data.openRatePct}%`,
      href: "/analytics/roi",
      renderDelta: () => <DeltaBadge value={data.openRateDelta} unit="%" />
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] bg-white/10 border-[0.5px] border-white/10 mb-8 p-[1px]">
      {kpis.map((kpi, idx) => {
        const Wrapper = kpi.href ? Link : "div";
        const wrapperProps = kpi.href ? { href: kpi.href } : {};
        return (
        <motion.div
          key={kpi.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitionCurve, delay: idx * 0.08 }}
        >
          <Wrapper
            {...(wrapperProps as any)}
            className={cn(
              "relative flex flex-col justify-between p-5 bg-[#030303] overflow-hidden group hover:bg-[#080808] transition-colors duration-500 ease-out h-full",
              kpi.isPrimary ? "bg-[#06080A]" : "",
              kpi.href ? "cursor-pointer" : ""
            )}
          >
          {kpi.isPrimary && (
            <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          )}

          <div className="flex items-start justify-between">
            <h3 title={kpi.tooltip} className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] font-medium cursor-help hover:text-zinc-300 transition-colors">
              {kpi.label}
            </h3>
            {kpi.href ? (
              <span className="text-[11px] text-zinc-700 group-hover:text-zinc-400 transition-colors">›</span>
            ) : (
              <span className="text-[7px] text-zinc-700 font-mono tracking-widest">0{idx + 1}</span>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <motion.div
              initial={{ scale: 0.95, filter: 'blur(4px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              transition={{ ...transitionCurve, delay: (idx * 0.08) + 0.1 }}
              className={cn(
                "text-4xl lg:text-5xl font-light tracking-tighter leading-none font-mono",
                kpi.isPrimary ? "text-blue-50" : "text-zinc-100"
              )}
            >
              {kpi.value}
            </motion.div>
            <div className="flex items-center min-h-[20px]">
              {kpi.renderDelta()}
            </div>
          </div>
          </Wrapper>
        </motion.div>
        );
      })}
    </div>
  );
}
