"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Mail, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { GlassCard } from "@/components/ui/GlassCard"
import { PrimaryButton } from "@/components/ui/PrimaryButton"
import { Input } from "@/components/ui/Input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getBrowserApiUrl } from "@/lib/api/browserBase"
import type { LandingCampaignSummary } from "@/modules/landing-agent/types"

export type DripCta = "asset" | "booking" | "reply" | "none"
export type DripPlaybookView = {
    kind: string
    name: string
    goal: string
    trigger: { kind: "landing_signup" | "link_click" | "inactivity" | "manual"; label: string; automatic: boolean }
    metric: string
    score: number
    reasons: string[]
    schedule: { delayDays: number; delayHours: number; cta: DripCta }[]
}
type Listing = { hasProfile: boolean; hasBookingLink: boolean; playbooks: DripPlaybookView[] }

const RECOMMENDED = 3

/** "Day 0" for the first email, "2 hours later" for same-day follow-ups, otherwise "Day N". */
export function dayLabel(step: { delayDays: number; delayHours: number }) {
    if (step.delayDays === 0 && step.delayHours > 0) return `+${step.delayHours}h`
    return `Day ${step.delayDays}`
}

async function post(path: string, body: unknown) {
    const res = await fetch(getBrowserApiUrl(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || `Something went wrong (HTTP ${res.status})`)
    return json
}

export function useDripPlaybooks() {
    const [data, setData] = useState<Listing | null>(null)
    const [failed, setFailed] = useState(false)
    useEffect(() => {
        let cancelled = false
        fetch(getBrowserApiUrl("/drip-playbooks"))
            .then(async (res) => {
                if (!res.ok) throw new Error()
                return (await res.json()) as Listing
            })
            .then((json) => !cancelled && setData(json))
            .catch(() => !cancelled && setFailed(true))
        return () => {
            cancelled = true
        }
    }, [])
    return { data, failed }
}

const field = "space-y-1"
const label = "text-sm font-medium text-foreground"

function PlaybookDialog({ playbook, hasBookingLink, onClose }: { playbook: DripPlaybookView; hasBookingLink: boolean; onClose: () => void }) {
    const [assetUrl, setAssetUrl] = useState("")
    const [assetLabel, setAssetLabel] = useState("")
    const [bookingUrl, setBookingUrl] = useState("")
    const [busy, setBusy] = useState(false)
    const [campaignId, setCampaignId] = useState<string | null>(null)
    const [on, setOn] = useState(false)
    const [pageId, setPageId] = useState("")
    const [linkUrl, setLinkUrl] = useState("")
    const [pages, setPages] = useState<{ id: string; title: string }[]>([])

    const wantsAsset = playbook.schedule.some((s) => s.cta === "asset")
    const wantsBooking = playbook.schedule.some((s) => s.cta === "booking")
    const trigger = playbook.trigger.kind

    useEffect(() => {
        if (!campaignId || trigger !== "landing_signup") return
        fetch(getBrowserApiUrl("/landing-agent/campaigns"))
            .then((res) => res.json())
            .then((json: { campaigns?: LandingCampaignSummary[] }) =>
                setPages((json.campaigns ?? []).flatMap((c) => c.pages.map((p) => ({ id: p.id, title: p.title || p.slug })))),
            )
            .catch(() => setPages([]))
    }, [campaignId, trigger])

    async function draft() {
        setBusy(true)
        try {
            const json = await post("/drip-playbooks/draft", {
                kind: playbook.kind,
                assetUrl: assetUrl.trim() || undefined,
                assetLabel: assetLabel.trim() || undefined,
                bookingUrl: bookingUrl.trim() || undefined,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
            setCampaignId(json.campaignId)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not write the emails")
        } finally {
            setBusy(false)
        }
    }

    async function switchOn() {
        setBusy(true)
        try {
            await post("/drip-playbooks/activate", { campaignId, active: true, landingPageId: pageId || undefined, linkUrl: linkUrl.trim() || undefined })
            setOn(true)
            toast.success("Playbook switched on")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not switch it on")
        } finally {
            setBusy(false)
        }
    }

    const canSwitch = trigger === "inactivity" || (trigger === "landing_signup" && pageId) || (trigger === "link_click" && linkUrl.trim())

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle>{playbook.name}</DialogTitle>
                </DialogHeader>

                {!campaignId && (
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-muted-foreground">
                            We write {playbook.schedule.length} emails from your website and ideal customer profile and save them as a draft. Nothing is sent yet.
                        </p>
                        {wantsAsset && (
                            <>
                                <div className={field}>
                                    <label htmlFor="drip-asset" className={label}>Link to your ebook, guide or brochure <span className="text-muted-foreground">(optional)</span></label>
                                    <Input id="drip-asset" placeholder="https://" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} />
                                </div>
                                <div className={field}>
                                    <label htmlFor="drip-asset-label" className={label}>Button text <span className="text-muted-foreground">(optional)</span></label>
                                    <Input id="drip-asset-label" placeholder="Get the guide" value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} />
                                </div>
                            </>
                        )}
                        {wantsBooking && (
                            <div className={field}>
                                <label htmlFor="drip-booking" className={label}>Booking link <span className="text-muted-foreground">(optional)</span></label>
                                <Input id="drip-booking" placeholder="https://" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} />
                                {hasBookingLink && <p className="text-xs text-muted-foreground">Leave empty to use the calendar link from your setup.</p>}
                            </div>
                        )}
                        {(wantsAsset || wantsBooking) && (
                            <p className="text-xs text-muted-foreground">An email with no link asks the reader to reply instead.</p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">Cancel</button>
                            <PrimaryButton onClick={draft} disabled={busy}>
                                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Writing emails...</> : "Write the emails"}
                            </PrimaryButton>
                        </div>
                    </div>
                )}

                {campaignId && !on && (
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-foreground">
                            The emails are saved as a draft. <Link className="underline font-semibold" href={`/campaigns/${campaignId}`}>Review and edit them</Link> before you switch this on.
                        </p>
                        {trigger === "landing_signup" && (
                            <div className={field}>
                                <label htmlFor="drip-page" className={label}>Start when someone signs up on</label>
                                <select id="drip-page" value={pageId} onChange={(e) => setPageId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">{pages.length ? "Choose a landing page" : "No landing pages yet"}</option>
                                    {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            </div>
                        )}
                        {trigger === "link_click" && (
                            <div className={field}>
                                <label htmlFor="drip-link" className={label}>Start when someone clicks this link in your emails</label>
                                <Input id="drip-link" placeholder="https://yoursite.com/brochure.pdf" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Use the link exactly as it appears in your email. Any link that starts with this address counts.</p>
                            </div>
                        )}
                        {trigger === "inactivity" && (
                            <p className="text-sm text-muted-foreground">
                                Starts for contacts who agreed to hear from you and have not opened or clicked in 90 days. At most 25 start each day.
                            </p>
                        )}
                        {trigger === "manual" && (
                            <p className="text-sm text-muted-foreground">You start this one yourself by adding a lead to it. It cannot start on its own.</p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">Not yet</button>
                            {trigger !== "manual" && (
                                <PrimaryButton onClick={switchOn} disabled={busy || !canSwitch}>
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Switch on"}
                                </PrimaryButton>
                            )}
                        </div>
                    </div>
                )}

                {on && (
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-foreground">It is on. {playbook.trigger.label}, and the emails start. It stops for anyone who replies, books or unsubscribes.</p>
                        <div className="flex justify-end">
                            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

export function DripPlaybooks() {
    const { data, failed } = useDripPlaybooks()
    const [open, setOpen] = useState<DripPlaybookView | null>(null)

    if (failed) return <p role="alert" className="text-sm text-muted-foreground">Could not load email playbooks. Try again later.</p>
    if (!data) {
        return (
            <div role="status" className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
                <span className="sr-only">Loading email playbooks...</span>
            </div>
        )
    }

    return (
        <section aria-labelledby="drip-heading" className="space-y-4">
            <div>
                <h2 id="drip-heading" className="text-lg font-bold text-foreground">Email playbooks</h2>
                <p className="text-sm text-muted-foreground">
                    Ready-made email series that start by themselves when someone signs up, clicks a link or goes quiet.
                    {data.hasProfile ? " Ranked for your business." : <> <Link href="/setup" className="underline">Scan your website in setup</Link> to rank them for your business.</>}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.playbooks.map((p, i) => (
                    <GlassCard key={p.kind} className="flex flex-col h-full hover:border-primary/50 transition-colors">
                        <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Mail className="w-5 h-5" /></div>
                                {i < RECOMMENDED && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded">
                                        <Sparkles className="w-3 h-3" /> Recommended
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-foreground">{p.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{p.goal}</p>
                            </div>
                            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Starts:</span> {p.trigger.label}</p>
                            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Emails:</span> {p.schedule.map(dayLabel).join(", ")}</p>
                            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Watch:</span> {p.metric}</p>
                            {i < RECOMMENDED && p.reasons.length > 0 && (
                                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                    {p.reasons.slice(0, 2).map((r) => <li key={r}>{r}</li>)}
                                </ul>
                            )}
                        </div>
                        <div className="mt-5 pt-4 border-t border-border">
                            <PrimaryButton onClick={() => setOpen(p)} className="w-full justify-center">Set up</PrimaryButton>
                        </div>
                    </GlassCard>
                ))}
            </div>
            {open && <PlaybookDialog playbook={open} hasBookingLink={data.hasBookingLink} onClose={() => setOpen(null)} />}
        </section>
    )
}
