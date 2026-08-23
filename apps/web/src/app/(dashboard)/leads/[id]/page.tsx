"use client";

import { use, useEffect, useState } from "react";
import { LeadDetail } from "@/components/crm/LeadDetail";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [lead, setLead] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setLead(null);
        const ctrl = new AbortController();
        fetch(getBrowserApiUrl(`/leads/${id}`), { signal: ctrl.signal })
            .then((res) => res.json())
            .then((data) => {
                setLead(data);
                setLoading(false);
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                console.error(err);
                setLoading(false);
            });
        return () => ctrl.abort();
    }, [id]);

    if (loading) return <div className="p-8 text-white/60">Loading lead details...</div>;
    if (!lead || lead.error) return <div className="p-8 text-white/60">Lead not found</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <LeadDetail lead={lead} />
        </div>
    );
}
