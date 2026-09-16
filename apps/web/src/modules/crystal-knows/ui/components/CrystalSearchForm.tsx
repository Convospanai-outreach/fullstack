"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type Props = {
    onSubmit: (data: Record<string, string>) => void;
    loading: boolean;
};

const FIELDS: Array<{ name: string; label: string; placeholder: string }> = [
    { name: "fullName", label: "Full Name", placeholder: "Jane Doe" },
    { name: "email", label: "Email", placeholder: "jane@acme.com" },
    { name: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/janedoe" },
    { name: "jobTitle", label: "Job Title", placeholder: "VP Sales" },
    { name: "companyName", label: "Company Name", placeholder: "Acme Corp" },
    { name: "phone", label: "Phone", placeholder: "+1 555 000 0000" },
];

export default function CrystalSearchForm({ onSubmit, loading }: Props) {
    const [values, setValues] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(values);
    };

    const hasIdentifier = !!(values["fullName"] || values["email"] || values["linkedinUrl"] || values["phone"]);

    return (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                    <div key={field.name}>
                        <label htmlFor={`crystal-${field.name}`} className="block mb-1.5 text-xs font-semibold text-foreground">
                            {field.label}
                        </label>
                        <input
                            id={`crystal-${field.name}`}
                            type="text"
                            value={values[field.name] || ""}
                            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                        />
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Provide at least a name, email, LinkedIn URL, or phone number.</p>
            <button
                type="submit"
                disabled={loading || !hasIdentifier}
                className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 text-xs font-medium rounded-md shadow-sm transition-all flex items-center gap-2"
            >
                <Search className="w-4 h-4" />
                {loading ? "Searching..." : "Find Personality Profile"}
            </button>
        </form>
    );
}
