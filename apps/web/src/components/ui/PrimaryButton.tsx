import React from 'react';
import { cn } from "@/lib/utils";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function PrimaryButton({ children, className, ...props }: PrimaryButtonProps) {
    return (
        <button
            className={cn(
                "px-5 py-2 rounded-[2px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition ease-smooth duration-200",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
