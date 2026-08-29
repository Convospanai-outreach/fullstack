"use client";

// PipelineTrendCard.tsx
// 30-day cumulative lead-count sparkline (Tier 2, left column).

interface PipelineTrendCardProps {
  trend: number[]; // 30 daily cumulative values, oldest first
  loading?: boolean;
}

export function PipelineTrendCard({ trend, loading }: PipelineTrendCardProps) {
  if (loading || trend.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-3.5 h-full animate-pulse">
        <div className="h-2.5 w-32 bg-muted rounded mb-4" />
        <div className="h-[110px] bg-muted rounded" />
      </div>
    );
  }

  const width = 300;
  const height = 110;
  const max = Math.max(...trend, 1);
  const min = Math.min(...trend);
  const range = Math.max(max - min, 1);
  const stepX = width / (trend.length - 1 || 1);

  const points = trend.map((value, i) => {
    const x = i * stepX;
    const y = height - ((value - min) / range) * (height - 10) - 5;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const latest = trend[trend.length - 1];
  const first = trend[0];
  const delta = latest - first;

  return (
    <div className="bg-card border border-border rounded-lg p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-muted-foreground">
          Pipeline trend — 30 days
        </p>
        <span className={`text-[10px] font-mono ${delta >= 0 ? "text-success" : "text-destructive"}`}>
          {delta >= 0 ? "+" : ""}{delta}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full flex-1" preserveAspectRatio="none">
        <line x1="0" y1={height - 5} x2={width} y2={height - 5} stroke="hsl(var(--border))" strokeWidth="1" />
        <polyline points={polyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        {points.length > 0 && (
          <circle cx={points[points.length - 1]!.x} cy={points[points.length - 1]!.y} r="2.5" fill="hsl(var(--primary))" />
        )}
      </svg>
      <p className="text-[18px] font-mono text-foreground mt-1">{latest}<span className="text-[10px] text-muted-foreground ml-1.5">active pipeline</span></p>
    </div>
  );
}
