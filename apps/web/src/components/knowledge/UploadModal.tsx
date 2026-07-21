"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PrimaryButton } from "@/components/ui/PrimaryButton"
import { Input } from "@/components/ui/Input"
import { toast } from "sonner"
import { Loader2, UploadCloud } from "lucide-react"

interface UploadModalProps {
    knowledgeBaseId: string
    onUploadComplete: () => void
}

export function UploadModal({ knowledgeBaseId, onUploadComplete }: UploadModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [content, setContent] = useState("")
    const [title, setTitle] = useState("")
    const [loading, setLoading] = useState(false)

    const handleUpload = async () => {
        if (!content || !title) {
            toast.error("Please fill in all fields");
            return;
        }

        setLoading(true)
        try {
            const res = await fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/knowledge/${knowledgeBaseId}/upload`, {
                method: "POST",
                body: JSON.stringify({
                    content,
                    metadata: { title, type: "text", source: "user_upload" }
                })
            })

            if (!res.ok) throw new Error("Upload failed")

            toast.success("Document processed and embedded successfully")
            setIsOpen(false)
            setContent("")
            setTitle("")
            onUploadComplete()
        } catch (error) {
            toast.error("Failed to upload document")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <PrimaryButton className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    Add Source
                </PrimaryButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-bg-base/90 backdrop-blur border-border-subtle text-text-primary">
                <DialogHeader>
                    <DialogTitle>Add Knowledge Source</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Document Title</label>
                        <Input
                            placeholder="e.g. Q3 Pricing Guide"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Content / Context</label>
                        <textarea
                            className="w-full h-40 bg-bg-glass border border-border-subtle rounded-md p-3 text-sm focus:outline-none focus:border-accent-blue"
                            placeholder="Paste the text content here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <p className="text-xs text-text-muted">
                            This text will be chunked and embedded for AI retrieval.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                    >
                        Cancel
                    </button>
                    <PrimaryButton onClick={handleUpload} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Process & Embed
                    </PrimaryButton>
                </div>
            </DialogContent>
        </Dialog>
    )
}
