import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen flex-col bg-background/50 selection:bg-purple-500/30">
            <NavBar />
            <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full z-10">
                {children}
            </main>
            <Footer />

            {/* Enhanced Background Gradients */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob" />
                <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000" />
                <div className="absolute -bottom-[20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-4000" />
                <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] bg-pink-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000" />
            </div>
        </div>
    );
}
