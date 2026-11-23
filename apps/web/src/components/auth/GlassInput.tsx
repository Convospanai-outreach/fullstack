import React from 'react';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: React.ReactNode;
}

export function GlassInput({ label, icon, className = '', ...props }: GlassInputProps) {
    return (
        <div className="space-y-1.5 group">
            {label && <label className="text-sm font-medium text-foreground/80 ml-1">{label}</label>}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    {icon}
                </div>
                <input
                    {...props}
                    className={`
            w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 rounded-xl 
            text-foreground placeholder:text-muted-foreground outline-none
            focus:border-primary/50 focus:bg-foreground/10 focus:ring-1 focus:ring-primary/50
            transition-all duration-300
            ${className}
          `}
                />
            </div>
        </div>
    );
}
