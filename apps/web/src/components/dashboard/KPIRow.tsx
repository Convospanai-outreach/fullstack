"use client";

// KPIRow.tsx
// Four KPI stat cards shown above the fold on the dashboard home page.
// North-star metrics: meetings booked, active leads, drafts ready, open rate.

interface KPIData {
  meetingsBooked: number;
  meetingsDelta: number;
  activeLeads: number;
  draftsReady: number;
  draftsPendingSend: number;
  openRatePct: number;
  openRateDelta: number;
}

function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  if (value > 0) return <span className="text-emerald-400">↑ {value}{unit} this week</span>;
  if (value < 0) return <span className="text-red-400">↓ {Math.abs(value)}{unit} this week</span>;
  return <span className="text-white/25">No change</span>;
}

function KPICardSkeleton() {
  return (
    <div className="bg-[#101624] border border-white/7 rounded-lg p-4 animate-pulse">
      <div className="h-2.5 w-20 bg-white/8 rounded mb-3" />
      <div className="h-6 w-14 bg-white/10 rounded mb-2" />
      <div className="h-2 w-24 bg-white/6 rounded" />
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      {/* Meetings booked — primary north-star card */}
      <div className="border border-blue-500/28 bg-[#101e33] rounded-lg p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/30">Meetings booked</p>
        <p className="text-[22px] font-medium text-blue-300 leading-none mt-1">{data.meetingsBooked}</p>
        <p className="text-[11px] mt-1">
          <Delta value={data.meetingsDelta} />
        </p>
      </div>

      {/* Active leads */}
      <div className="bg-[#101624] border border-white/7 rounded-lg p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/30">Active leads</p>
        <p className="text-[22px] font-medium text-slate-200 leading-none mt-1">{data.activeLeads}</p>
        <p className="text-[11px] mt-1 text-white/25">In pipeline</p>
      </div>

      {/* Drafts ready */}
      <div className="bg-[#101624] border border-white/7 rounded-lg p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/30">Drafts ready</p>
        <p className="text-[22px] font-medium text-slate-200 leading-none mt-1">{data.draftsReady}</p>
        <p className="text-[11px] mt-1">
          {data.draftsPendingSend > 0 ? (
            <span className="text-amber-400">{data.draftsPendingSend} need sending</span>
          ) : (
            <span className="text-white/25">All sent</span>
          )}
        </p>
      </div>

      {/* Open rate */}
      <div className="bg-[#101624] border border-white/7 rounded-lg p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/30">Open rate</p>
        <p className="text-[22px] font-medium text-slate-200 leading-none mt-1">{data.openRatePct}%</p>
        <p className="text-[11px] mt-1">
          <Delta value={data.openRateDelta} unit="%" />
        </p>
      </div>
    </div>
  );
}
