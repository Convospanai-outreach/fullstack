type Props = { icp: any };

export default function ICPCard({ icp }: Props) {
    const criteria = icp.criteria as any;

    return (
        <div style={{
            background: "#fff",
            borderRadius: 10,
            padding: 16,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}>
            <h3 style={{ margin: 0, marginBottom: 8 }}>{icp.name}</h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>
                {icp.description || "No description"}
            </p>

            <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {criteria.industries && (
                    <div>Industries: {criteria.industries.join(", ")}</div>
                )}
                {criteria.jobTitles && (
                    <div>Titles: {criteria.jobTitles.join(", ")}</div>
                )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <a href={`/icp-builder/${icp.id}`} style={{ fontSize: 12, color: "#0ea5e9" }}>
                    Edit
                </a>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>•</span>
                <span style={{ fontSize: 12, color: icp.status === "active" ? "#10b981" : "#6b7280" }}>
                    {icp.status}
                </span>
            </div>
        </div>
    );
}
