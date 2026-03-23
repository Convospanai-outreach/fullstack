import React from 'react';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: React.ReactNode;
}

export function GlassInput({ label, icon, className = '', ...props }: GlassInputProps) {
    return (
        <div className="space-y-1.5 group">
            {label && <label className="text-sm font-medium text-gray-300 ml-1">{label}</label>}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-purple-400 transition-colors">
                    {icon}
                </div>
                <input
                    {...props}
                    className={`
            w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl 
            text-white placeholder:text-gray-600 outline-none
            focus:border-purple-500/50 focus:bg-white/10 focus:ring-1 focus:ring-purple-500/50
            transition-all duration-300
            ${className}
          `}
                />
            </div>
        </div>
    );
}
