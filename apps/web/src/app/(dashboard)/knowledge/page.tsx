"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { GlassCard } from "@/components/ui/GlassCard"
import { UploadModal } from "@/components/knowledge/UploadModal"
import { Search, Database } from "lucide-react"
import { Input } from "@/components/ui/Input"

export default function KnowledgePage() {
    const [kbId, setKbId] = useState<string | null>(null)
    const [_loading, setLoading] = useState(true)
    const [docs, setDocs] = useState<any[]>([])
    const [query, setQuery] = useState("")

    // Fetch initial KB (create default if none)
    useEffect(() => {
        const init = async () => {
            const listRes = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/knowledge")
            const listData = await listRes.json()

            if (listData.data && listData.data.length > 0) {
                setKbId(listData.data[0].id)
                // In a real app we'd fetch docs here, but we don't have a list-docs endpoint yet, strictly search or upload.
                // Let's implement a quick search for "*" or just use search to list.
                // For now, we'll just wait for user action.
            } else {
                // Auto-create default KB
                const createRes = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/knowledge", {
                    method: "POST",
                    body: JSON.stringify({ name: "General Knowledge", description: "Default team context" })
                })
                const createData = await createRes.json()
                setKbId(createData.data.id)
            }
            setLoading(false)
        }
        init()
    }, [])

    const handleTestSearch = async () => {
        if (!kbId || !query) return
        const res = await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/knowledge/${kbId}/upload?q=${encodeURIComponent(query)}`) // Re-using the GET handler in upload route
        const data = await res.json()
        setDocs(data.data)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Knowledge Vault</h1>
                    <p className="text-text-secondary mt-1">Manage context sources for your AI agents.</p>
                </div>
                {kbId && <UploadModal knowledgeBaseId={kbId} onUploadComplete={() => { }} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Search / Test Playground */}
                <div className="md:col-span-2 space-y-6">
                    <GlassCard>
                        <div className="flex items-center gap-3 mb-4">
                            <Database className="w-5 h-5 text-accent-violet" />
                            <h2 className="text-lg font-semibold">Semantic Search Test</h2>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ask a question to test retrieval (e.g. 'What is our pricing?')"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                            />
                            <button
                                onClick={handleTestSearch}
                                className="bg-white/10 p-2 rounded-md hover:bg-white/20"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        </div>
                    </GlassCard>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Retrieval Results</h3>
                        {docs.length === 0 && (
                            <div className="text-center py-10 text-text-muted bg-white/5 rounded-xl border border-dashed border-white/10">
                                No results found or no search performed.
                            </div>
                        )}
                        {docs.map((doc: any, _i) => (
                            <GlassCard key={doc.id} className="border-l-4 border-l-accent-mint">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-accent-mint">{doc.metadata?.title || "Untitled"}</h4>
                                    <span className="text-xs bg-white/10 px-2 py-1 rounded-full">Score: {(doc.score * 100).toFixed(1)}%</span>
                                </div>
                                <p className="text-sm text-text-secondary line-clamp-3">{doc.content}</p>
                            </GlassCard>
                        ))}
                    </div>
                </div>

                {/* Sidebar / Stats */}
                <div className="space-y-6">
                    <GlassCard className="bg-gradient-to-br from-accent-violet/10 to-transparent">
                        <h3 className="text-lg font-semibold mb-2">Vault Status</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Active Collection</span>
                                <span>Default</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Total Documents</span>
                                <span>{docs.length > 0 ? "..." : "Unknown"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Embedding Model</span>
                                <span className="font-mono text-xs">gemini-1.5-flash</span>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    )
}
