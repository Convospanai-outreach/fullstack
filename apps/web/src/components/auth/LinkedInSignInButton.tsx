"use client";

import { useEffect, useState } from "react";
import { getProviders } from "next-auth/react";

// Renders nothing unless LinkedIn sign-in is switched on (see @/lib/linkedinLogin).
export default function LinkedInSignInButton({ onClick }: { onClick: () => void }) {
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        getProviders()
            .then((providers) => setAvailable(Boolean(providers?.["linkedin"])))
            .catch(() => {});
    }, []);

    if (!available) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
        >
            Continue with LinkedIn
        </button>
    );
}
