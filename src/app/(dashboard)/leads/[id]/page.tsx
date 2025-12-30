"use client";

import { useEffect, useState } from "react";
import { LeadDetail } from "@/components/crm/LeadDetail";

export default function LeadPage({ params }: { params: { id: string } }) {
    const [lead, setLead] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/leads/${params.id}`)
            .then((res) => res.json())
            .then((data) => {
                setLead(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, [params.id]);

    if (loading) return <div className="p-8 text-white/60">Loading lead details...</div>;
    if (!lead || lead.error) return <div className="p-8 text-white/60">Lead not found</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <LeadDetail lead={lead} />
        </div>
    );
}
