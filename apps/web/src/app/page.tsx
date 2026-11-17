import HomeV8 from "@/components/marketing/v8/HomeV8";
import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "CraftMyFunnel AI — Fluid Funnel Engine",
  description:
    "CraftMyFunnel AI turns live buyer signals into governed outreach, structured human follow-up, sovereign processing, and qualified revenue.",
  alternates: {
    canonical: "https://craftmyfunnel.live",
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#020617] text-white">
      <NavBar />
      <div className="flex-1 w-full relative z-10">
        <HomeV8 />
      </div>
      <Footer hideCTA={true} />
    </div>
  );
}
