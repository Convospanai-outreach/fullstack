"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-[rgba(26,20,20,.6)] backdrop-blur-[4px] flex items-center justify-center z-50 p-4">
            <div
                className="glass-strong rounded-[4px] overflow-hidden w-full max-w-md animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-border bg-foreground/5">
                    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition p-1 rounded-lg hover:bg-foreground/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 text-muted-foreground leading-relaxed">
                    {children}
                </div>

                {footer && (
                    <div className="p-6 border-t border-border bg-foreground/5 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
