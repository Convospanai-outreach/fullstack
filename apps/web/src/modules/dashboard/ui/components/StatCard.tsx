

type Props = { title: string; value: string | number; hint?: string };

export default function StatCard({ title, value, hint }: Props) {
    return (
        <div style={{
            background: "hsl(var(--card))", borderRadius: 10, padding: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            minWidth: 160
        }}>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            {hint && <div style={{ marginTop: 8, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{hint}</div>}
        </div>
    );
}
