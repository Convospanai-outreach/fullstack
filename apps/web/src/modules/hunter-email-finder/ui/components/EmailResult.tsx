type Props = {
    result: any;
};

export default function EmailResult({ result }: Props) {
    const scoreColor = result.score >= 80 ? "hsl(var(--success))" : result.score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

    return (
        <div style={{ background: "hsl(var(--card))", padding: 24, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.06)", marginTop: 24, color: "hsl(var(--foreground))" }}>
            <h3 style={{ margin: 0, marginBottom: 16 }}>Result</h3>

            {result.email ? (
                <>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>Email Address</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{result.email}</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>Confidence Score</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: scoreColor }}>{result.score}%</div>
                    </div>

                    {result.position && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>Position</div>
                            <div>{result.position}</div>
                        </div>
                    )}

                    {result.sources && result.sources.length > 0 && (
                        <div>
                            <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>Sources ({result.sources.length})</div>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                                {result.sources.slice(0, 3).map((source: any, i: number) => (
                                    <li key={i}>{source.domain}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ color: "hsl(var(--muted-foreground))" }}>No email found for this person.</div>
            )}
        </div>
    );
}
