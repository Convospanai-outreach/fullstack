"use client"

import { useState } from "react"
import { GlassCard } from "@/components/ui/GlassCard"
import { PrimaryButton } from "@/components/ui/PrimaryButton"
import { Input } from "@/components/ui/Input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookOpen, Play, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PlaybookCardProps {
    playbook: any
}

export function PlaybookCard({ playbook }: PlaybookCardProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [params, setParams] = useState<Record<string, string>>({})
    const router = useRouter()

    const handleUse = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/playbooks/${playbook.id}/instantiate`, {
                method: "POST",
                body: JSON.stringify({ values: params })
            })
            const json = await res.json()

            if (!json.success) throw new Error(json.error)

            toast.success("Campaign created from playbook!")
            setIsOpen(false)
            router.push(`/campaigns/${json.data.id}`)
        } catch (error: any) {
            toast.error(error.message || "Failed to instantiate playbook")
        } finally {
            setLoading(false)
        }
    }

    // Identify required params from the JSON list (e.g. ["company", "offer"])
    const requiredParams = Array.isArray(playbook.parameters) ? playbook.parameters : []

    return (
        <>
            <GlassCard className="flex flex-col h-full hover:border-primary/50 transition-colors">
                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        {playbook.isLocked && <span className="text-xs bg-red-500/10 text-red-700 dark:text-red-400 font-semibold px-2 py-1 rounded">Locked</span>}
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-foreground">{playbook.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{playbook.description || "No description"}</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                    <PrimaryButton
                        onClick={() => setIsOpen(true)}
                        className="w-full justify-center"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Use Playbook
                    </PrimaryButton>
                </div>
            </GlassCard>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Configure Playbook: {playbook.name}</DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            This playbook requires some inputs to customize the campaign for your needs.
                        </p>

                        {requiredParams.length === 0 && (
                            <div className="p-3 bg-muted/40 rounded-md border border-border/50 text-sm text-muted-foreground italic">
                                No parameters required. Ready to launch.
                            </div>
                        )}

                        {requiredParams.map((key: string) => (
                            <div key={key} className="space-y-2">
                                <label htmlFor={`param-${key}`} className="text-sm font-medium text-foreground capitalize">
                                    {key.replace(/_/g, ' ')}
                                </label>
                                <Input
                                    id={`param-${key}`}
                                    placeholder={`Enter ${key}...`}
                                    value={params[key] || ""}
                                    onChange={(e) => setParams(prev => ({ ...prev, [key]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            Cancel
                        </button>
                        <PrimaryButton onClick={handleUse} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Create Campaign"}
                        </PrimaryButton>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

