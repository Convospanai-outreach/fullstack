import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'outline' | 'ghost';
    fullWidth?: boolean;
}

export function ActionButton({ children, variant = 'primary', fullWidth = false, className = '', ...props }: ActionButtonProps) {
    const baseStyles = "py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]";

    const variants = {
        primary: "bg-gradient-to-r from-primary to-primary/60 hover:from-primary hover:to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 border border-foreground/10",
        outline: "bg-transparent border border-foreground/10 hover:bg-foreground/5 text-foreground/80 hover:text-foreground",
        ghost: "bg-transparent hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
