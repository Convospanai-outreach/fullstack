"use client";

import { useState } from "react";

type Props = {
    criteria: any;
    onChange: (criteria: any) => void;
};

export default function CriteriaBuilder({ criteria, onChange }: Props) {
    const [industries, setIndustries] = useState<string[]>(criteria.industries || []);
    const [jobTitles, setJobTitles] = useState<string[]>(criteria.jobTitles || []);

    const addIndustry = (industry: string) => {
        const updated = [...industries, industry];
        setIndustries(updated);
        onChange({ ...criteria, industries: updated });
    };

    const addJobTitle = (title: string) => {
        const updated = [...jobTitles, title];
        setJobTitles(updated);
        onChange({ ...criteria, jobTitles: updated });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Industries
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {industries.map((ind, i) => (
                        <span key={i} style={{ padding: "4px 8px", background: "#e0f2fe", borderRadius: 4, fontSize: 12 }}>
                            {ind}
                        </span>
                    ))}
                </div>
                <input
                    type="text"
                    placeholder="Add industry..."
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                            addIndustry(e.currentTarget.value);
                            e.currentTarget.value = "";
                        }
                    }}
                    style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, width: "100%" }}
                />
            </div>

            <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Job Titles
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {jobTitles.map((title, i) => (
                        <span key={i} style={{ padding: "4px 8px", background: "#e0f2fe", borderRadius: 4, fontSize: 12 }}>
                            {title}
                        </span>
                    ))}
                </div>
                <input
                    type="text"
                    placeholder="Add job title..."
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                            addJobTitle(e.currentTarget.value);
                            e.currentTarget.value = "";
                        }
                    }}
                    style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, width: "100%" }}
                />
            </div>
        </div>
    );
}
