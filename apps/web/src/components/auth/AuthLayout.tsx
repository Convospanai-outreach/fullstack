import React from 'react';
import Link from 'next/link';

interface AuthLayoutProps {
    children: React.ReactNode;
    heading: string;
    subheading?: string;
    showLogo?: boolean;
}

export default function AuthLayout({ children, heading, subheading, showLogo = true }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Main Glass Card */}
            <div className="glass w-full max-w-md p-8 rounded-2xl relative z-10 flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
                {showLogo && (
                    <div className="flex justify-center mb-2">
                        <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            CraftMyFunnel
                        </Link>
                    </div>
                )}

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-white">{heading}</h1>
                    {subheading && <p className="text-gray-400 text-sm">{subheading}</p>}
                </div>

                {children}
            </div>

            {/* Footer / Trust Badge area could go here outside the card if needed */}
            <div className="absolute bottom-6 text-center text-xs text-gray-500">
                <p>AI-Powered &middot; Enterprise Secure &middot; GDPR Compliant</p>
            </div>
        </div>
    );
}
