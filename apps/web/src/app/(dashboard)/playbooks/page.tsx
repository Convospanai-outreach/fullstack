"use client"

import { useEffect, useState } from "react"
import { PlaybookCard } from "@/components/playbooks/PlaybookCard"
import { PrimaryButton } from "@/components/ui/PrimaryButton"
import { Loader2, Plus } from "lucide-react"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { getBrowserApiUrl } from "@/lib/api/browserBase"

import { toast } from "sonner"

export default function PlaybooksPage() {
    const [playbooks, setPlaybooks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        fetchPlaybooks()
    }, [])

    const fetchPlaybooks = async () => {
        try {
            const res = await fetch(getBrowserApiUrl("/playbooks"))
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}))
                throw new Error(errJson?.error || `Failed to fetch playbooks (HTTP ${res.status})`)
            }
            const data = await res.json()
            if (Array.isArray(data)) {
                setPlaybooks(data)
            }
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Failed to load playbooks")
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        setCreating(true)
        try {
            const res = await fetch(getBrowserApiUrl("/playbooks"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Untitled Playbook",
                    description: "",
                    parameters: [],
                    config: {
                        type: "standard",
                        emails: []
                    }
                })
            })
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}))
                throw new Error(errJson?.error || `Failed to create playbook (HTTP ${res.status})`)
            }
            toast.success("Playbook created successfully")
            await fetchPlaybooks()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Failed to create playbook")
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <SectionHeader title="Playbooks" subtitle="Standardized templates for your team." />
                <PrimaryButton onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {creating ? "Creating..." : "New Playbook"}
                </PrimaryButton>
            </div>

            {loading ? (
                <div role="status" aria-live="polite" className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
                    <span className="sr-only">Loading playbooks...</span>
                </div>
            ) : (
                <>
                    {playbooks.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card">
                            <h3 className="text-lg font-semibold text-foreground">No playbooks yet</h3>
                            <p className="text-muted-foreground mb-4 text-sm">Create your first template to get started.</p>
                            <PrimaryButton onClick={handleCreate} disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                {creating ? "Creating..." : "Create Playbook"}
                            </PrimaryButton>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {playbooks.map(pb => (
                                <PlaybookCard key={pb.id} playbook={pb} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

