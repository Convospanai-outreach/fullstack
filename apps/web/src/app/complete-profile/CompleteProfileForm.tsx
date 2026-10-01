"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/LogoMark";

type Fields = { firstName: string; lastName: string; phone: string; company: string };

const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none";

export default function CompleteProfileForm({ initial, nextPath }: { initial: Fields; nextPath: string }) {
    const router = useRouter();
    const [fields, setFields] = useState<Fields>(initial);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFields({ ...fields, [key]: e.target.value });

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/profile/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fields),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not save your details. Please try again.");
                return;
            }
            router.push(nextPath);
            router.refresh();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <form onSubmit={submit} className="w-full max-w-md space-y-4">
                <div className="mb-2 flex items-center justify-center gap-2 text-xl font-black">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </div>
                <h1 className="text-center text-lg font-semibold">Finish setting up your profile</h1>
                <div className="grid grid-cols-2 gap-3">
                    <input required aria-label="First name" placeholder="First name" autoComplete="given-name" className={inputClass} value={fields.firstName} onChange={set("firstName")} />
                    <input required aria-label="Last name" placeholder="Last name" autoComplete="family-name" className={inputClass} value={fields.lastName} onChange={set("lastName")} />
                </div>
                <input required aria-label="Company name" placeholder="Company name" autoComplete="organization" className={inputClass} value={fields.company} onChange={set("company")} />
                <input required aria-label="Phone number" placeholder="Phone number" type="tel" autoComplete="tel" className={inputClass} value={fields.phone} onChange={set("phone")} />
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-60"
                >
                    {saving ? "Saving..." : "Continue"}
                </button>
            </form>
        </div>
    );
}
