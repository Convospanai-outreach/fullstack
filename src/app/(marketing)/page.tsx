import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import HeroScene from "@/components/marketing/HeroScene";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative selection:bg-purple-500/30">
      {/* 3D Background */}
      <HeroScene />

      {/* Background Gradients (Legacy/Fallback) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-pink-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Navbar Placeholder */}
      <div className="h-20"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32 pb-32">

        {/* HERO SECTION */}
        <section className="text-center pt-20">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm font-medium text-purple-300">
            ✨ The Future of Automated Outreach is Here
          </div>
          <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tight leading-tight">
            Reclaim Your Time, <br />
            <span className="gradient-text">Supercharge Your Growth</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Stop wasting hours on manual follow-ups. ConvoSpan's AI agents orchestrate intelligent, human-like conversations that convert leads while you sleep.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/signup">
              <Button variant="primary" className="px-10 py-5 text-xl w-full sm:w-auto shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all">
                Start for Free
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" className="px-10 py-5 text-xl w-full sm:w-auto">
                View Demo Dashboard
              </Button>
            </Link>
          </div>

          <div className="mt-16 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md max-w-5xl mx-auto shadow-2xl">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-900 to-black overflow-hidden relative border border-white/5 shadow-2xl">
              <Image
                src="/images/dashboard-preview.png"
                alt="Dashboard Preview"
                fill
                className="object-cover opacity-90 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </section>

        {/* KEY BENEFITS */}
        <section>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Why Top Teams Choose ConvoSpan</h2>
            <p className="text-xl text-gray-400">More than just automation. It's your 24/7 sales team.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard className="p-8 hover:bg-white/10 transition-colors duration-300">
              <div className="h-14 w-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-3xl">
                😴
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Sleep While We Work</h3>
              <p className="text-gray-400 leading-relaxed">
                Our agents work across time zones, engaging prospects the moment they are active. Wake up to booked meetings, not unread emails.
              </p>
            </GlassCard>

            <GlassCard className="p-8 hover:bg-white/10 transition-colors duration-300">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6 text-3xl">
                🧠
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">AI That Sounds Like You</h3>
              <p className="text-gray-400 leading-relaxed">
                Forget robotic templates. Our Gemini-powered brain analyzes profiles and crafts hyper-personalized messages that actually get replies.
              </p>
            </GlassCard>

            <GlassCard className="p-8 hover:bg-white/10 transition-colors duration-300">
              <div className="h-14 w-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6 text-3xl">
                🛡️
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Enterprise-Grade Safety</h3>
              <p className="text-gray-400 leading-relaxed">
                Built-in safe mode throttling ensures your accounts stay healthy. We mimic human behavior patterns to fly under the radar.
              </p>
            </GlassCard>
          </div>
        </section>

        {/* FEATURES FLOW */}
        <section className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500/0 via-purple-500/50 to-purple-500/0 -translate-x-1/2 hidden md:block"></div>

          <div className="space-y-24">
            <div className="flex flex-col md:flex-row items-center gap-12 relative">
              <div className="flex-1 text-right md:pr-12">
                <h3 className="text-3xl font-bold text-white mb-4">1. Define Your ICP</h3>
                <p className="text-xl text-gray-400">
                  Use our precision filters to target the exact job titles, industries, and locations you want to reach.
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-600 border-4 border-black z-10 flex items-center justify-center font-bold text-xl shrink-0">1</div>
              <div className="flex-1 md:pl-12">
                <GlassCard className="p-2 aspect-video flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-black overflow-hidden relative">
                  <Image
                    src="/images/dashboard-preview.png"
                    alt="Targeting Engine"
                    fill
                    className="object-cover rounded-lg opacity-80"
                  />
                </GlassCard>
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-12 relative">
              <div className="flex-1 text-left md:pl-12">
                <h3 className="text-3xl font-bold text-white mb-4">2. Build Your Workflow</h3>
                <p className="text-xl text-gray-400">
                  Drag and drop actions to create complex sequences. Visit profile → Wait 1 day → Connect → Send Message.
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-600 border-4 border-black z-10 flex items-center justify-center font-bold text-xl shrink-0">2</div>
              <div className="flex-1 md:pr-12">
                <GlassCard className="p-2 aspect-video flex items-center justify-center bg-gradient-to-bl from-blue-900/40 to-black overflow-hidden relative">
                  <Image
                    src="/images/workflow-preview.png"
                    alt="Workflow Builder"
                    fill
                    className="object-cover rounded-lg opacity-80"
                  />
                </GlassCard>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-12 relative">
              <div className="flex-1 text-right md:pr-12">
                <h3 className="text-3xl font-bold text-white mb-4">3. Launch & Optimize</h3>
                <p className="text-xl text-gray-400">
                  Hit start and watch the live feed. Our A/B testing module automatically routes traffic to the best-performing variants.
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-pink-600 border-4 border-black z-10 flex items-center justify-center font-bold text-xl shrink-0">3</div>
              <div className="flex-1 md:pl-12">
                <GlassCard className="p-2 aspect-video flex items-center justify-center bg-gradient-to-br from-pink-900/40 to-black overflow-hidden relative">
                  <Image
                    src="/images/analytics-preview.png"
                    alt="Analytics Dashboard"
                    fill
                    className="object-cover rounded-lg opacity-80"
                  />
                </GlassCard>
              </div>
            </div>
          </div>

        </section>

        {/* ROI / STATS SECTION */}
        <section className="bg-white/5 border-y border-white/10 py-24 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-16">Real Results, Real Fast</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="p-6">
                <div className="text-5xl font-bold gradient-text mb-4">3x</div>
                <p className="text-xl text-gray-300">More Meetings Booked</p>
                <p className="text-sm text-gray-500 mt-2">vs. manual outreach</p>
              </div>
              <div className="p-6 border-x border-white/10">
                <div className="text-5xl font-bold text-white mb-4">40%</div>
                <p className="text-xl text-gray-300">Time Saved Weekly</p>
                <p className="text-sm text-gray-500 mt-2">on repetitive tasks</p>
              </div>
              <div className="p-6">
                <div className="text-5xl font-bold text-blue-400 mb-4">&lt;1%</div>
                <p className="text-xl text-gray-300">Bounce Rate</p>
                <p className="text-sm text-gray-500 mt-2">with verified data</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS / PROCESS */}
        <section className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">From Sign-up to Sales in Minutes</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { title: "Connect Accounts", icon: "🔌", desc: "Link your email and LinkedIn safely." },
              { title: "Define Audience", icon: "🎯", desc: "Use precision filters to find your ICP." },
              { title: "Launch Agents", icon: "🚀", desc: "Select a workflow and hit start." },
              { title: "Close Deals", icon: "🤝", desc: "Jump in when prospects are interested." }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-blue-600/20 rounded-2xl blur-xl group-hover:bg-purple-600/20 transition-all duration-500 opacity-0 group-hover:opacity-100" />
                <GlassCard className="relative h-full flex flex-col items-center text-center p-8 border border-white/10 group-hover:border-purple-500/30 transition-all">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl mb-6 shadow-inner">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.desc}</p>
                </GlassCard>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: "Is my LinkedIn account safe?", a: "Absolutely. We use cloud-based browsers with unique IPs and human-like delays to ensure compliance and safety." },
              { q: "Can I bring my own leads?", a: "Yes! You can upload CSVs or use our built-in enrichment tools to find leads directly." },
              { q: "Do you offer a free trial?", a: "We offer a 14-day full-access trial. No credit card required to start exploring." },
              { q: "How many seats are included?", a: "Our Starter plan includes 1 seat. Pro plans offer unlimited team seats with centralized billing." }
            ].map((faq, i) => (
              <details key={i} className="group glass-card rounded-xl overflow-hidden cursor-pointer transition-all duration-300">
                <summary className="flex justify-between items-center p-6 text-lg font-medium text-white hover:bg-white/5 transition-colors list-none">
                  {faq.q}
                  <span className="transform group-open:rotate-180 transition-transform text-gray-400">▼</span>
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section>
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">Loved by Growth Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                quote: "ConvoSpan completely transformed our outbound. We booked 3x more meetings in the first month.",
                author: "Sarah J.",
                role: "VP of Sales, TechFlow"
              },
              {
                quote: "The AI personalization is scary good. People think I'm actually writing these messages manually.",
                author: "Mike T.",
                role: "Founder, StartScale"
              },
              {
                quote: "Finally, a tool that doesn't get my accounts banned. The safety features are top-notch.",
                author: "Elena R.",
                role: "Growth Lead, DataCo"
              }
            ].map((t, i) => (
              <GlassCard key={i} className="p-8 flex flex-col justify-between">
                <p className="text-lg text-gray-300 italic mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-700 to-gray-600"></div>
                  <div>
                    <div className="font-semibold text-white">{t.author}</div>
                    <div className="text-sm text-gray-500">{t.role}</div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900 to-blue-900 opacity-50"></div>
          <div className="relative z-10 p-16 text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white">Ready to Automate Your Growth?</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Join thousands of sales professionals who are saving time and closing more deals with ConvoSpan.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="px-12 py-6 text-xl">Get Started Now</Button>
              </Link>
            </div>
            <p className="text-sm text-gray-400">No credit card required for 14-day trial.</p>
          </div>
        </section>

        {/* FOOTER LINKS */}
        <footer className="border-t border-white/10 pt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-4">
            <h4 className="font-bold text-white">Product</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/features" className="hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/campaigns" className="hover:text-white">Campaigns</Link></li>
              <li><Link href="/roadmap" className="hover:text-white">Roadmap</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-white">Resources</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
              <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
              <li><Link href="/api-docs" className="hover:text-white">API Docs</Link></li>
              <li><Link href="/community" className="hover:text-white">Community</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-white">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/about" className="hover:text-white">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div className="space-y-4 col-span-2 md:col-span-1">
            <h4 className="font-bold text-white">ConvoSpan</h4>
            <p className="text-gray-500">
              Empowering sales teams with AI-driven automation.
            </p>
            <div className="flex gap-4">
              {/* Social Icons Placeholders */}
              <div className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 cursor-pointer"></div>
              <div className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 cursor-pointer"></div>
              <div className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 cursor-pointer"></div>
            </div>
          </div>
        </footer>

      </div >
    </div >
  );
}
