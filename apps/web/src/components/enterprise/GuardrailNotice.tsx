"use client";

import { ShieldAlert } from 'lucide-react';

interface GuardrailNoticeProps {
    rule: string;
}

export function GuardrailNotice({ rule }: GuardrailNoticeProps) {
    return (
        <div className="glass border-l-4 border-accent-violet p-4 rounded-r-xl flex items-start gap-3 bg-accent-violet/5">
            <ShieldAlert className="w-5 h-5 text-accent-violet shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
                <span className="text-text-primary font-semibold">Enterprise Policy:</span>
                <p className="text-text-secondary mt-1">{rule}</p>
            </div>
        </div>
    );
}
