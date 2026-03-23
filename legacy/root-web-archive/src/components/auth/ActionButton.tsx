import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'outline' | 'ghost';
    fullWidth?: boolean;
}

export function ActionButton({ children, variant = 'primary', fullWidth = false, className = '', ...props }: ActionButtonProps) {
    const baseStyles = "py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]";

    const variants = {
        primary: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20 border border-white/10",
        outline: "bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
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
