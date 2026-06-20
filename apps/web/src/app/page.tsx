import CinematicHome from "@/components/marketing/CinematicHome";
import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "CraftMyFunnel — Fluid Funnel Engine",
  description:
    "CraftMyFunnel turns live buyer signals into governed outreach, structured human follow-up, sovereign processing, and qualified revenue.",
};

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#020617] text-white">
      <NavBar />
      <main className="flex-1 w-full relative z-10">
        <CinematicHome />
      </main>
      <Footer />
    </div>
  );
}
