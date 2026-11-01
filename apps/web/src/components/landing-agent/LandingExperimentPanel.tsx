"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import { landingExperimentApi, type ExperimentResults, type ExperimentRow } from "@/modules/landing-agent/service/landingExperimentApi";
import { conversionText, statusLabel, verdictMessage } from "./landingExperimentCopy";
import { validatePagePath } from "./landingPageAddress";

interface PageOption {
    id: string;
    title: string;
    slug: string;
    status: string;
}

// A/B tests between two published pages on one shared path (phase 6B). Starting, pausing and ending
// take effect on the connected domains through the Worker's KV mapping, which the API writes.
export default function LandingExperimentPanel() {
    const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
    const [pages, setPages] = useState<PageOption[]>([]);
    const [results, setResults] = useState<Record<string, ExperimentResults>>({});
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [path, setPath] = useState("");
    const [pageAId, setPageAId] = useState("");
    const [pageBId, setPageBId] = useState("");
    const [weightA, setWeightA] = useState(50);

    async function reload() {
        try {
            const [rows, campaigns] = await Promise.all([landingExperimentApi.list(), landingAgentApi.listCampaigns()]);
            setExperiments(rows);
            setPages(campaigns.campaigns.flatMap((c) => c.pages.map((p) => ({ id: p.id, title: p.title ?? p.slug, slug: p.slug, status: p.status }))));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load tests");
        }
    }

    useEffect(() => {
        void reload();
    }, []);

    async function run(action: () => Promise<unknown>) {
        setError(null);
        try {
            await action();
            await reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : "The change could not be saved");
        }
    }

    function create() {
        const checked = validatePagePath(path);
        if (!checked.ok) {
            setError(checked.error);
            return;
        }
        void run(async () => {
            await landingExperimentApi.create({ name: name.trim() || "Untitled test", slug: checked.path, pageAId, pageBId, weightA });
            setName("");
            setPath("");
        });
    }

    async function showResults(experimentId: string) {
        try {
            const r = await landingExperimentApi.results(experimentId);
            setResults((prev) => ({ ...prev, [experimentId]: r }));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load results");
        }
    }

    const publishedPages = pages.filter((p) => p.status === "published");

    return (
        <GlassCard className="p-6 space-y-6">
            <div>
                <h2 className="text-lg font-semibold">A/B tests</h2>
                <p className="text-sm text-muted-foreground">
                    Two published pages share one address. Visitors are split by weight and stay on the same page.
                </p>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <div className="space-y-3">
                <label className="block text-sm">
                    Test name
                    <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="block text-sm">
                    Shared address (path)
                    <input className="mt-1 w-full rounded border px-2 py-1" value={path} onChange={(e) => setPath(e.target.value)} />
                </label>
                <label className="block text-sm">
                    Variant A page
                    <select className="mt-1 w-full rounded border px-2 py-1" value={pageAId} onChange={(e) => setPageAId(e.target.value)}>
                        <option value="">Choose a published page</option>
                        {publishedPages.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                    </select>
                </label>
                <label className="block text-sm">
                    Variant B page
                    <select className="mt-1 w-full rounded border px-2 py-1" value={pageBId} onChange={(e) => setPageBId(e.target.value)}>
                        <option value="">Choose a published page</option>
                        {publishedPages.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                    </select>
                </label>
                <label className="block text-sm">
                    Share of visitors for A (1 to 99%)
                    <input
                        type="number"
                        min={1}
                        max={99}
                        className="mt-1 w-full rounded border px-2 py-1"
                        value={weightA}
                        onChange={(e) => setWeightA(Number(e.target.value))}
                    />
                </label>
                <Button onClick={create} disabled={!pageAId || !pageBId || pageAId === pageBId}>
                    Create test
                </Button>
            </div>

            <ul className="space-y-4">
                {experiments.map((exp) => {
                    const pageTitle = (id: string) => pages.find((p) => p.id === id)?.title ?? id;
                    const r = results[exp.id];
                    return (
                        <li key={exp.id} className="rounded border p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="font-medium">{exp.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        /{exp.slug} · {statusLabel(exp.status)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(exp.status === "draft" || exp.status === "paused") && (
                                        <Button size="sm" onClick={() => run(() => landingExperimentApi.act(exp.id, "start"))}>Start</Button>
                                    )}
                                    {exp.status === "running" && (
                                        <Button size="sm" variant="outline" onClick={() => run(() => landingExperimentApi.act(exp.id, "pause"))}>Pause</Button>
                                    )}
                                    {(exp.status === "running" || exp.status === "paused") && (
                                        <Button size="sm" variant="outline" onClick={() => run(() => landingExperimentApi.act(exp.id, "end"))}>End test</Button>
                                    )}
                                    {exp.status !== "draft" && (
                                        <Button size="sm" variant="outline" onClick={() => void showResults(exp.id)}>Show results</Button>
                                    )}
                                </div>
                            </div>

                            {r && (
                                <div className="space-y-2 text-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr>
                                                <th>Variant</th>
                                                <th>Visitors</th>
                                                <th>Form starts</th>
                                                <th>Leads</th>
                                                <th>Conversion</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(["A", "B"] as const).map((v) => {
                                                const row = exp.variants.find((x) => x.name === v);
                                                const c = r.variants[v];
                                                return (
                                                    <tr key={v}>
                                                        <td>{v}: {row ? pageTitle(row.landingPageId) : ""}</td>
                                                        <td>{c.visitors}</td>
                                                        <td>{c.formStarts}</td>
                                                        <td>{c.leads}</td>
                                                        <td>{conversionText(c.conversionRate)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <p>{verdictMessage(r)}</p>
                                    {exp.status !== "ended" || !exp.winnerPageId ? (
                                        <div className="flex gap-2">
                                            {exp.variants.map((v) => (
                                                <Button
                                                    key={v.id}
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={r.verdict.status !== "clear_winner"}
                                                    onClick={() => run(() => landingExperimentApi.pickWinner(exp.id, v.landingPageId))}
                                                >
                                                    Pick {v.name} as winner
                                                </Button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>Winner: {pageTitle(exp.winnerPageId)}</p>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </GlassCard>
    );
}
