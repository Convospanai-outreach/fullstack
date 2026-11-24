"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showHeader = pathname !== "/";

    return (
        <>
            {showHeader && <NavBar />}
            <main id="main-content" className={`flex-1 focus:outline-none ${showHeader ? "pt-20" : ""}`}>{children}</main>
            {showHeader && <Footer />}
        </>
    );
}
