"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORE_URL } from "@/lib/extensionIds";

const REPLY_TIMEOUT_MS = 8000;
const NOT_REACHABLE =
    "We couldn't reach the CraftMyFunnel extension from this page. Use Chrome with the latest version of the extension installed and turned on, then retry.";

type Status =
    | { state: "working"; step: string }
    | { state: "ready" }
    | { state: "done"; teamName: string | null }
    | { state: "error"; message: string; showInstall: boolean; reload: boolean };

const STARTING: Status = { state: "working", step: "Looking for the extension..." };

class ConnectError extends Error {
    constructor(message: string, readonly showInstall = false, readonly reload = false) {
        super(message);
    }
}

function errorStatus(error: unknown): Status {
    return error instanceof ConnectError
        ? { state: "error", message: error.message, showInstall: error.showInstall, reload: error.reload }
        : { state: "error", message: "Something went wrong while connecting. Please retry.", showInstall: false, reload: false };
}

// chrome.runtime only exists on this page when an installed extension lists the site in
// externally_connectable, so a missing runtime means "not Chrome" or "not installed".
function sendToExtension(extensionId: string, message: Record<string, unknown>): Promise<any> {
    const runtime = (window as any).chrome?.runtime;
    if (!runtime?.sendMessage) return Promise.reject(new ConnectError(NOT_REACHABLE, true));

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new ConnectError("The extension didn't answer. Reload it from chrome://extensions, then retry."));
        }, REPLY_TIMEOUT_MS);
        try {
            runtime.sendMessage(extensionId, message, (reply: unknown) => {
                clearTimeout(timer);
                if (runtime.lastError || !reply) {
                    reject(new ConnectError(NOT_REACHABLE, true));
                    return;
                }
                resolve(reply);
            });
        } catch {
            clearTimeout(timer);
            reject(new ConnectError(NOT_REACHABLE, true));
        }
    });
}

// The extension stores the apex site; www and apex are the same workspace.
function workspaceOrigin() {
    const origin = window.location.origin;
    return origin === "https://www.craftmyfunnel.live" ? "https://craftmyfunnel.live" : origin;
}

export default function ConnectExtension({ extensionId }: { extensionId: string }) {
    const [status, setStatus] = useState<Status>(STARTING);
    const started = useRef(false);

    const findExtension = useCallback(async () => {
        try {
            const ping = await sendToExtension(extensionId, { type: "CMF_PING" });
            if (!ping?.ok) throw new ConnectError(NOT_REACHABLE, true);
            setStatus({ state: "ready" });
        } catch (error) {
            setStatus(errorStatus(error));
        }
    }, [extensionId]);

    // Creates the sync token and hands it over only after the user clicks Connect.
    async function connect() {
        setStatus({ state: "working", step: "Creating a sync token..." });
        try {
            const res = await fetch("/api/extension/token", { method: "POST" });
            const data = await res.json().catch(() => null);
            if (res.status === 401) throw new ConnectError("Your session has ended. Sign in again, then retry.", false, true);
            if (!res.ok || !data?.ok || !data.token) throw new ConnectError(data?.error || "We couldn't create a sync token. Please retry.");

            setStatus({ state: "working", step: "Connecting the extension..." });
            const reply = await sendToExtension(extensionId, {
                type: "CMF_CONNECT",
                version: 1,
                workspaceUrl: workspaceOrigin(),
                syncToken: data.token,
                expiresAt: data.expiresAt,
                team: data.team ?? null,
            });
            if (!reply?.ok) throw new ConnectError(reply?.error || "The extension couldn't save the connection.");

            setStatus({ state: "done", teamName: data.team?.name ?? null });
        } catch (error) {
            setStatus(errorStatus(error));
        }
    }

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        void findExtension();
    }, [findExtension]);

    function retry() {
        // A reload goes through sign-in again when the session has ended.
        if (status.state === "error" && status.reload) {
            window.location.reload();
            return;
        }
        setStatus(STARTING);
        void findExtension();
    }

    if (status.state === "working") {
        return <p className="text-center text-sm text-slate-300" role="status">{status.step}</p>;
    }

    if (status.state === "ready") {
        return (
            <div className="space-y-3 text-center text-sm text-slate-300">
                <p>The extension will save leads to the team you&apos;re in now.</p>
                <button
                    type="button"
                    onClick={() => void connect()}
                    className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                    Connect the extension
                </button>
            </div>
        );
    }

    if (status.state === "done") {
        return (
            <div className="space-y-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" role="status">
                <p className="font-semibold">
                    {status.teamName ? `Connected to ${status.teamName}. You can close this tab.` : "Connected. You can close this tab."}
                </p>
                {status.teamName && (
                    <p className="text-emerald-200/80">
                        Leads you save with the extension go to the team {status.teamName}. To save to a different team, switch teams in CraftMyFunnel and connect again.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
            <p>{status.message}</p>
            {status.showInstall && (
                <p>
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 hover:text-cyan-200">
                        Get the extension from the Chrome Web Store
                    </a>
                </p>
            )}
            <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
                {status.reload ? "Sign in again" : "Retry"}
            </button>
        </div>
    );
}
