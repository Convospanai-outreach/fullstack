import React from 'react';
import { cn } from "@/lib/utils";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function PrimaryButton({ children, className, ...props }: PrimaryButtonProps) {
    return (
        <button
            className={cn(
                "px-5 py-2 rounded-xl bg-accent-blue text-white font-medium shadow-glow hover:scale-[1.02] transition ease-smooth duration-200",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
