"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { KeywordTriggers } from "@/components/content/KeywordTriggers";

type SocialAccount = {
    id: string;
    platform: "FACEBOOK_PAGE" | "INSTAGRAM" | "LINKEDIN_MEMBER" | "LINKEDIN_ORG";
    handle: string | null;
    status: "CONNECTED" | "NEEDS_RECONNECT";
    lastError: string | null;
    tokenExpiresAt: string | null;
};

const ACCOUNTS_URL = getBrowserApiUrl("/social/accounts");
const LINKEDIN_AVAILABLE_URL = "/api/integrations/linkedin/available";
const PLATFORMS = {
    FACEBOOK_PAGE: { label: "Facebook Page", Icon: Facebook },
    INSTAGRAM: { label: "Instagram", Icon: Instagram },
    LINKEDIN_MEMBER: { label: "LinkedIn profile", Icon: Linkedin },
    LINKEDIN_ORG: { label: "LinkedIn page", Icon: Linkedin },
} as const;

const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`social accounts ${res.status}`);
    return res.json();
};

// Creator funnel: the Instagram accounts, Facebook Pages and LinkedIn profiles/pages CraftMyFunnel
// posts from (and, for Meta, reads DMs and comments on). Meta uses the same sign-in as Lead Ads,
// with extra permissions; LinkedIn has its own sign-in, and company pages use a second LinkedIn app.
export default function SocialAccountsPage() {
    const params = useSearchParams();
    const { data, error, mutate } = useSWR<{ accounts: SocialAccount[] }>(ACCOUNTS_URL, fetcher);
    const { data: linkedin } = useSWR<{ profile: boolean; pages: boolean }>(LINKEDIN_AVAILABLE_URL, fetcher);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        if (params.get("connected") === "true") toast.success("Accounts connected.");
        if (params.get("connected") === "false") toast.error(params.get("error") || "Couldn't connect. Try again.");
    }, [params]);

    const startSignIn = async (busyKey: string, startUrl: string) => {
        setBusy(busyKey);
        try {
            const res = await fetch(startUrl);
            const body = await res.json().catch(() => null);
            if (!res.ok || !body?.authUrl) throw new Error(body?.error || "Couldn't start the connection.");
            window.location.assign(body.authUrl);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't start the connection.");
            setBusy(null);
        }
    };
    const connect = () => startSignIn("connect", "/api/integrations/facebook/oauth/start?purpose=social&next=/settings/social");
    const connectLinkedIn = (kind: "profile" | "pages") => startSignIn(`linkedin-${kind}`, `/api/integrations/linkedin/oauth/start?kind=${kind}`);
    const reconnect = (account: SocialAccount) =>
        account.platform === "LINKEDIN_MEMBER" ? connectLinkedIn("profile") : account.platform === "LINKEDIN_ORG" ? connectLinkedIn("pages") : connect();

    const disconnect = async (account: SocialAccount) => {
        setBusy(account.id);
        try {
            const res = await fetch(`${ACCOUNTS_URL}/${encodeURIComponent(account.id)}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            await mutate();
            toast.success("Disconnected.");
        } catch {
            toast.error("Couldn't disconnect. Only workspace admins can.");
        } finally {
            setBusy(null);
        }
    };

    const accounts = data?.accounts ?? [];

    return (
        <div className="space-y-6">
            <SectionHeader title="Social accounts" subtitle="Instagram, Facebook Pages and LinkedIn you post from, and the Meta accounts you get messages on." />

            <GlassCard className="p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Sign in with Facebook and pick your Pages. Instagram professional accounts linked to those Pages connect too.
                    </p>
                    <button
                        type="button"
                        onClick={connect}
                        disabled={busy !== null}
                        className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                        {busy === "connect" ? "Opening Facebook..." : accounts.length ? "Connect more or reconnect" : "Connect Instagram and Facebook"}
                    </button>
                </div>

                {(linkedin?.profile || linkedin?.pages) && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Sign in with LinkedIn to post to your profile{linkedin.pages ? " or to company pages you manage" : ""}. LinkedIn asks you to sign in again every 60 days.
                        </p>
                        <div className="flex shrink-0 gap-2">
                            {linkedin.profile && (
                                <button
                                    type="button"
                                    onClick={() => connectLinkedIn("profile")}
                                    disabled={busy !== null}
                                    className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                                >
                                    {busy === "linkedin-profile" ? "Opening LinkedIn..." : "Connect LinkedIn profile"}
                                </button>
                            )}
                            {linkedin.pages && (
                                <button
                                    type="button"
                                    onClick={() => connectLinkedIn("pages")}
                                    disabled={busy !== null}
                                    className="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50"
                                >
                                    {busy === "linkedin-pages" ? "Opening LinkedIn..." : "Connect LinkedIn page"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-destructive">Couldn&apos;t load your accounts.</p>}
                {!error && data && accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected yet.</p>}

                {accounts.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {accounts.map((account) => {
                            const { label, Icon } = PLATFORMS[account.platform];
                            const needsReconnect = account.status === "NEEDS_RECONNECT";
                            // A connected account can still carry a problem, e.g. its messages couldn't be subscribed.
                            const warning = needsReconnect || Boolean(account.lastError);
                            return (
                                <li key={account.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm text-foreground">{account.handle || label}</p>
                                            <p className={`text-xs ${warning ? "text-warning" : "text-muted-foreground"}`}>
                                                {label} · {needsReconnect ? `Needs reconnecting${account.lastError ? `: ${account.lastError}` : ""}` : account.lastError ? `Connected. ${account.lastError}` : "Connected"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 text-xs">
                                        {warning && (
                                            <button type="button" onClick={() => reconnect(account)} disabled={busy !== null} className="font-medium text-primary hover:underline disabled:opacity-50">
                                                Reconnect
                                            </button>
                                        )}
                                        <button type="button" onClick={() => disconnect(account)} disabled={busy !== null} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                                            {busy === account.id ? "Disconnecting..." : "Disconnect"}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <p className="text-xs text-muted-foreground">
                    To read Instagram DMs, turn on Instagram Settings &gt; Messages and story replies &gt; Message controls &gt; Connected tools &gt; Allow access to messages.
                </p>
            </GlassCard>

            <GlassCard className="p-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">Keyword auto-replies</h2>
                <KeywordTriggers />
            </GlassCard>
        </div>
    );
}
