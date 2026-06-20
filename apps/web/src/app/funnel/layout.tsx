import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

export default function FunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#020617] text-white">
      {/* 
        NavBar is fixed/absolute at the top and manages its own z-index/blur.
        We place it here so it applies to the /funnel route globally.
      */}
      <NavBar />
      
      {/* 
        The main scroll container. We do NOT add top padding or max-width here
        so the cinematic full-screen canvas can expand to the full viewport.
      */}
      <main className="flex-1 w-full relative z-10">
        {children}
      </main>

      {/* 
        Global footer will render naturally at the very bottom of the document
        after the post-funnel content scrolls to the end.
      */}
      <Footer />
    </div>
  );
}
