"use client";

import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="glass w-full max-w-lg p-8 rounded-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    ✕
                </button>

                <h2 className="text-2xl font-bold gradient-text mb-2">Upgrade Your Plan</h2>
                <p className="text-gray-300 mb-6">Unlock the full power of the AI Agent Army.</p>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-200">Unlimited LinkedIn Scrapes</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-200">Advanced AI Personalization</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-200">Priority Support</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 border-0">
                        Upgrade Now - $99/mo
                    </Button>
                    <button onClick={onClose} className="px-6 py-3 text-gray-300 hover:text-white">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
