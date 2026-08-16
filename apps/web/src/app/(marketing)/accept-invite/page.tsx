"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";

type InvitationPreview = {
    email: string;
    role: string;
    teamName: string;
    expiresAt: string;
};

export default function AcceptInvitePage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
    const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("invalid");
            setError("This invite link is missing a token.");
            return;
        }

        fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.valid) {
                    setInvitation(data.invitation);
                    setStatus("valid");
                } else {
                    setError(data.error || "This invite link is no longer valid.");
                    setStatus("invalid");
                }
            })
            .catch(() => {
                setError("Unable to check this invite link right now.");
                setStatus("invalid");
            });
    }, [token]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black text-white">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel
                </Link>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    {status === "loading" && (
                        <p className="text-sm text-slate-300">Checking your invite...</p>
                    )}

                    {status === "invalid" && (
                        <>
                            <p className="text-sm text-rose-300">{error}</p>
                            <Link
                                href="/login"
                                className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                            >
                                Go to login
                            </Link>
                        </>
                    )}

                    {status === "valid" && invitation && (
                        <>
                            <p className="text-sm text-slate-300">
                                You&apos;ve been invited to join
                            </p>
                            <p className="mt-1 text-lg font-bold text-white">{invitation.teamName}</p>
                            <p className="mt-3 text-sm text-slate-400">
                                {invitation.email} &middot; {invitation.role}
                            </p>
                            <Link
                                href={`/signup?token=${encodeURIComponent(token)}`}
                                className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                            >
                                Accept invite &amp; sign up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
