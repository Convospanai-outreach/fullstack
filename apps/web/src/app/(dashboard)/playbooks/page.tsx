"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
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
                    <h1 className="text-3xl font-bold text-text-primary">Playbooks</h1>
                    <p className="text-text-secondary mt-1">Standardized templates for your team.</p>
                </div>
                <PrimaryButton onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Playbook
                </PrimaryButton>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
                </div>
            ) : (
                <>
                    {playbooks.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-border-subtle rounded-xl bg-white/5">
                            <h3 className="text-lg font-medium text-text-primary">No playbooks yet</h3>
                            <p className="text-text-secondary mb-4">Create your first template to get started.</p>
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
