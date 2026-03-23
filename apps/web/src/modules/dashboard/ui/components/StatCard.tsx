

type Props = { title: string; value: string | number; hint?: string };

export default function StatCard({ title, value, hint }: Props) {
    return (
        <div style={{
            background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            minWidth: 160
        }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            {hint && <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>{hint}</div>}
        </div>
    );
}
