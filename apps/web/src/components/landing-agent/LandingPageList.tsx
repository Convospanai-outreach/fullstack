"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import type { LandingCampaignSummary } from "@/modules/landing-agent/types";
import { galleryTemplates } from "./landingTemplateGallery";
import { pageLink, shownDomain, validatePagePath } from "./landingPageAddress";

// Where a landing campaign picks up again: the editor once a page exists, else the step it stopped at.
export function nextStep(campaign: LandingCampaignSummary): { href: string; label: string; status: string } {
    const base = `/landing-agent/${encodeURIComponent(campaign.id)}`;
    const page = campaign.pages[0];
    if (page) {
        const status = page.status === "published" ? (page.hasUnpublishedChanges ? "Published · Unpublished changes" : "Published") : "Draft";
        return { href: `${base}/editor`, label: "Edit", status };
    }
    if (campaign._count.wireframeOptions > 0) {
        return { href: `${base}/wireframes`, label: "Pick a layout", status: "Not built yet" };
    }
    return { href: `${base}/brief`, label: "Continue", status: "Not built yet" };
}

// "Used by N auto-replies": how many Instagram keyword replies send people to this page.
export function autoReplyLabel(count: number): string {
    return `Used by ${count} auto-repl${count === 1 ? "y" : "ies"}`;
}

const TEMPLATES = galleryTemplates();

export default function LandingPageList() {
    const [campaigns, setCampaigns] = useState<LandingCampaignSummary[] | null>(null);
    const [domains, setDomains] = useState<string[]>([]);
    const [liveDomain, setLiveDomain] = useState<string | null>(null);
    const [chosenDomain, setChosenDomain] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newPath, setNewPath] = useState("");
    const [newTemplateId, setNewTemplateId] = useState(TEMPLATES[0]?.id ?? "");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [editing, setEditing] = useState<{ campaignId: string; pageId: string; value: string; currentSlug: string } | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    const shown = shownDomain(domains, chosenDomain ?? liveDomain);

    async function load() {
        try {
            const data = await landingAgentApi.listCampaigns();
            setCampaigns(data.campaigns);
            setDomains(data.domains ?? []);
            setLiveDomain(data.liveDomain);
        } catch (err: any) {
            setError(err?.message || "Failed to load landing pages");
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function createDraft() {
        const checked = validatePagePath(newPath);
        if (!checked.ok) {
            setCreateError(checked.error);
            return;
        }
        const template = TEMPLATES.find((t) => t.id === newTemplateId);
        if (!template) {
            setCreateError("Choose a template.");
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            await landingAgentApi.createCampaignFromTemplate({ templateId: template.id, name: template.name, path: checked.path });
            setNewPath("");
            await load();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Could not create the page.");
        } finally {
            setCreating(false);
        }
    }

    async function saveAddress() {
        if (!editing) return;
        const checked = validatePagePath(editing.value, editing.currentSlug);
        if (!checked.ok) {
            setEditError(checked.error);
            return;
        }
        try {
            await landingAgentApi.setPageSlug(editing.campaignId, editing.pageId, checked.path);
            setEditing(null);
            setEditError(null);
            await load();
        } catch (err) {
            setEditError(err instanceof Error ? err.message : "Could not change the address.");
        }
    }

    async function copyLink(slug: string) {
        try {
            await navigator.clipboard.writeText(pageLink(shown, slug));
            setCopiedSlug(slug);
        } catch {
            setCopiedSlug(null);
        }
    }

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <GlassCard className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Landing pages</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Open a page to edit it, or start a new one.</p>
                    </div>
                    <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white">
                        <Link href="/landing-agent/new">New landing page</Link>
                    </Button>
                </div>
            </GlassCard>

            <GlassCard className="p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">New page at /something</h2>
                <p className="text-sm text-muted-foreground">Choose a template and a path. The page is saved as a draft and goes live only when you publish it.</p>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Path
                        <input
                            aria-label="New page path"
                            value={newPath}
                            maxLength={63}
                            placeholder="spring-guide"
                            onChange={(e) => setNewPath(e.target.value)}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Template
                        <select
                            aria-label="Template"
                            value={newTemplateId}
                            onChange={(e) => setNewTemplateId(e.target.value)}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        >
                            {TEMPLATES.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button onClick={createDraft} disabled={creating}>
                        {creating ? "Creating..." : "Create draft"}
                    </Button>
                </div>
                {createError ? (
                    <p role="alert" className="text-sm text-destructive">
                        {createError}
                    </p>
                ) : null}
            </GlassCard>

            {domains.length > 0 ? (
                <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    Show addresses on
                    <select
                        aria-label="Domain"
                        value={shown ?? ""}
                        onChange={(e) => setChosenDomain(e.target.value)}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                        {domains.map((domain) => (
                            <option key={domain} value={domain}>
                                {domain}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            {error ? <GlassCard className="p-8 text-destructive">{error}</GlassCard> : null}
            {!error && campaigns === null ? <GlassCard className="p-8 text-muted-foreground">Loading landing pages...</GlassCard> : null}
            {campaigns?.length === 0 ? <GlassCard className="p-8 text-muted-foreground">No landing pages yet.</GlassCard> : null}

            {campaigns && campaigns.length > 0 ? (
                <GlassCard className="p-0">
                    <ul className="divide-y divide-border">
                        {campaigns.map((campaign) => {
                            const page = campaign.pages[0];
                            const step = nextStep(campaign);
                            const editingThis = editing !== null && page !== undefined && editing.pageId === page.id;
                            return (
                                <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">{page?.title || campaign.name}</p>
                                        {page ? (
                                            <p className="mt-1 truncate text-xs text-foreground">{shown ? `${shown}/${page.slug}` : `/p/${page.slug}`}</p>
                                        ) : null}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {step.status} · {campaign._count.leads} sign-up{campaign._count.leads === 1 ? "" : "s"} · edited{" "}
                                            {new Date(page?.updatedAt || campaign.updatedAt).toLocaleDateString()}
                                        </p>
                                        {page?.autoReplies ? <p className="mt-1 text-xs text-muted-foreground">{autoReplyLabel(page.autoReplies.total)}</p> : null}
                                        {editing && editingThis ? (
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <input
                                                    aria-label="Page path"
                                                    value={editing.value}
                                                    maxLength={63}
                                                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                                    className="rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground"
                                                />
                                                <Button variant="outline" onClick={saveAddress}>
                                                    Save address
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditing(null);
                                                        setEditError(null);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : null}
                                        {editingThis && editError ? (
                                            <p role="alert" className="mt-1 text-xs text-destructive">
                                                {editError}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {page?.status === "published" ? (
                                            <>
                                                <Button asChild variant="outline">
                                                    <a href={pageLink(shown, page.slug)} target="_blank" rel="noopener noreferrer">
                                                        View live
                                                    </a>
                                                </Button>
                                                <Button variant="outline" onClick={() => copyLink(page.slug)}>
                                                    {copiedSlug === page.slug ? "Copied" : "Copy link"}
                                                </Button>
                                            </>
                                        ) : null}
                                        {page && page.status !== "published" && !editingThis ? (
                                            <Button variant="outline" onClick={() => setEditing({ campaignId: campaign.id, pageId: page.id, value: page.slug, currentSlug: page.slug })}>
                                                Change address
                                            </Button>
                                        ) : null}
                                        <Button asChild>
                                            <Link href={step.href}>{step.label}</Link>
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </GlassCard>
            ) : null}
        </div>
    );
}
