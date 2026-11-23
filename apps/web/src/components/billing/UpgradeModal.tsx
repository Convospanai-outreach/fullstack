"use client";

import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="glass w-full max-w-lg p-8 rounded-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    ✕
                </button>

                <h2 className="text-2xl font-bold gradient-text mb-2">Upgrade Your Plan</h2>
                <p className="text-foreground/80 mb-6">Unlock the full power of the AI Agent Army.</p>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-success">✓</span>
                        <span className="text-foreground">Unlimited LinkedIn Scrapes</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-success">✓</span>
                        <span className="text-foreground">Advanced AI Personalization</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-success">✓</span>
                        <span className="text-foreground">Priority Support</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button className="flex-1 bg-gradient-to-r from-primary to-primary/60 border-0">
                        Upgrade Now - $99/mo
                    </Button>
                    <button onClick={onClose} className="px-6 py-3 text-foreground/80 hover:text-foreground">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
