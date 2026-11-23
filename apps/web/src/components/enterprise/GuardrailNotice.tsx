"use client";

import { ShieldAlert } from 'lucide-react';

interface GuardrailNoticeProps {
    rule: string;
}

export function GuardrailNotice({ rule }: GuardrailNoticeProps) {
    return (
        <div className="glass border-l-4 border-primary p-4 rounded-r-xl flex items-start gap-3 bg-primary/5">
            <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
                <span className="text-foreground font-semibold">Enterprise Policy:</span>
                <p className="text-muted-foreground mt-1">{rule}</p>
            </div>
        </div>
    );
}
