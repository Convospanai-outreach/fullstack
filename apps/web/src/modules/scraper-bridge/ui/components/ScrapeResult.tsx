type Props = {
    result: any;
};

export default function ScrapeResult({ result }: Props) {
    return (
        <section aria-labelledby="scrape-result-heading" className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-sm">
            <h2 id="scrape-result-heading" className="text-xl font-bold mb-4 text-foreground">Scrape Result</h2>

            <div className="mb-3 flex items-center gap-2">
                <span className="font-semibold text-foreground">Status:</span>
                <span className={`font-medium ${result.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {result.success ? "Success" : "Failed"}
                </span>
            </div>

            <div className="mb-3 flex items-center gap-2">
                <span className="font-semibold text-foreground">URL:</span>
                <a
                    href={result.metadata?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 dark:text-sky-400 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-sky-600 rounded"
                >
                    {result.metadata?.url}
                </a>
            </div>

            <div className="mb-4 flex items-center gap-2">
                <span className="font-semibold text-foreground">Duration:</span>
                <span className="text-foreground">{result.metadata?.duration}ms</span>
            </div>

            {result.screenshot && (
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Screenshot</h3>
                    <img
                        src={`data:image/png;base64,${result.screenshot}`}
                        alt="Screenshot of scraped web page"
                        className="max-w-full rounded-md border border-border"
                    />
                </div>
            )}

            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Data</h3>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs text-foreground font-mono">
                    {JSON.stringify(result.data, null, 2)}
                </pre>
            </div>
        </section>
    );
}

