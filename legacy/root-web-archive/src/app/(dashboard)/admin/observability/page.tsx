"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ObservabilityPage() {
    const [data, setData] = useState<any>(null);
    const [range, setRange] = useState("1h");

    useEffect(() => {
        fetch(`${process.env['NEXT_PUBLIC_API_URL']}/admin/observability?range=${range}`)
            .then((res) => res.json())
            .then((d) => {
                setData(d);
            });
    }, [range]);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">System Observability</h1>
            <Card className="p-4">
                <div className="flex gap-2 mb-4">
                    {["1h", "6h", "24h", "7d"].map((r) => (
                        <Badge
                            key={r}
                            className="cursor-pointer"
                            variant={range === r ? "default" : "outline"}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </Badge>
                    ))}
                </div>
                {data ? (
                    <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                ) : (
                    <p>Loading metrics...</p>
                )}
            </Card>
        </div>
    );
}
