"use client"

import { useEffect, useState } from "react"
import { PlaybookCard } from "@/components/playbooks/PlaybookCard"
import { PrimaryButton } from "@/components/ui/PrimaryButton"
import { Loader2, Plus } from "lucide-react"

export default function PlaybooksPage() {
    const [playbooks, setPlaybooks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPlaybooks()
    }, [])

    const fetchPlaybooks = async () => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/playbooks")
            const data = await res.json()
            if (Array.isArray(data)) {
                setPlaybooks(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/playbooks", {
            method: "POST",
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
        fetchPlaybooks()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Playbooks</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Standardized templates for your team.</p>
                </div>
                <PrimaryButton onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Playbook
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
                            <PrimaryButton onClick={handleCreate}>Create Playbook</PrimaryButton>
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

