"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyTeamPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/settings/team");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-gray-400">Redirecting to Team Settings...</p>
        </div>
    );
}
