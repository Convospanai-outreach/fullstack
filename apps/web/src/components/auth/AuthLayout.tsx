import React from 'react';
import Link from 'next/link';
import { LogoMark } from "@/components/brand/LogoMark";

interface AuthLayoutProps {
    children: React.ReactNode;
    heading: string;
    subheading?: string;
    showLogo?: boolean;
}

export default function AuthLayout({ children, heading, subheading, showLogo = true }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="glass w-full max-w-md p-8 rounded-2xl relative z-10 flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
                {showLogo && (
                    <div className="flex justify-center mb-2">
                        <Link href="/" className="flex items-center gap-2 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-card to-secondary">
                            <LogoMark className="h-8 w-8" />
                            CraftMyFunnel
                        </Link>
                    </div>
                )}

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{heading}</h1>
                    {subheading && <p className="text-muted-foreground text-sm">{subheading}</p>}
                </div>

                {children}
            </div>

            <div className="absolute bottom-6 text-center text-xs text-muted-foreground">
                <p>Human-approved &middot; Workspace-ready &middot; Secure by design</p>
            </div>
        </div>
    );
}
