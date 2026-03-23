type Props = {
    result: any;
};

export default function ScrapeResult({ result }: Props) {
    return (
        <div style={{ background: "#fff", padding: 24, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: 0, marginBottom: 16 }}>Scrape Result</h3>

            <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 600, marginRight: 8 }}>Status:</span>
                <span style={{ color: result.success ? "#10b981" : "#ef4444" }}>
                    {result.success ? "Success" : "Failed"}
                </span>
            </div>

            <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 600, marginRight: 8 }}>URL:</span>
                <a href={result.metadata.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0ea5e9" }}>
                    {result.metadata.url}
                </a>
            </div>

            <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 600, marginRight: 8 }}>Duration:</span>
                {result.metadata.duration}ms
            </div>

            {result.screenshot && (
                <div style={{ marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 8 }}>Screenshot</h4>
                    <img
                        src={`data:image/png;base64,${result.screenshot}`}
                        alt="Scraped Screenshot"
                        style={{ maxWidth: "100%", border: "1px solid #e5e7eb", borderRadius: 6 }}
                    />
                </div>
            )}

            <div>
                <h4 style={{ marginBottom: 8 }}>Data</h4>
                <pre style={{ background: "#f3f4f6", padding: 16, borderRadius: 6, overflowX: "auto", fontSize: 12 }}>
                    {JSON.stringify(result.data, null, 2)}
                </pre>
            </div>
        </div>
    );
}
