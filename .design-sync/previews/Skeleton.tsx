import { Skeleton } from "@craftmyfunnel/ui-sync";

export function Loading() {
  return (
    <div style={{ background: "#020617", padding: 16, display: "flex", flexDirection: "column", gap: 10, width: 280 }}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
