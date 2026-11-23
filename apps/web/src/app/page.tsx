import HomePresidio from "@/components/marketing/home/HomePresidio";
import { NavBar } from "@/components/NavBar";
import Footer from "@/components/Footer";
import { getTestimonials } from "@/lib/testimonials";

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
    <div className="relative min-h-screen flex flex-col bg-[#F3EDE4] text-[#1A1414]">
      <NavBar />
      <div className="flex-1 w-full relative z-10">
        <HomePresidio testimonial={getTestimonials()[0] ?? null} />
      </div>
      <Footer hideCTA={true} />
    </div>
  );
}
