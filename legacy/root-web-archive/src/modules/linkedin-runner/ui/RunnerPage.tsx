"use client";

import { useState } from "react";

export default function RunnerPage() {
    const [response, setResponse] = useState<any>(null);

    async function run() {
        const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/linkedin-runner/run", {
            method: "POST",
            body: JSON.stringify({
                profileUrl: "https://linkedin.com/in/example",
                action: "scrape",
            }),
        }).then((r) => r.json());

        setResponse(res);
    }

    return (
        <div style={{ padding: 40 }}>
            <h1>LinkedIn Automation</h1>
            <button onClick={run}>Run Automation</button>
            {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
        </div>
    );
}
