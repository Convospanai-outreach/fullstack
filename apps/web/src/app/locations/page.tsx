import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Building2, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import { CITIES_MATRIX } from '@/lib/locations';

export const metadata: Metadata = {
  title: 'Regional Outbound Sales Hubs & Local Coverage | CraftMyFunnel',
  description: 'Explore CraftMyFunnel regional B2B outbound hubs across 10 commercial corridors. Governed AI sales outreach tailored for local enterprise clusters.',
  alternates: {
    canonical: 'https://craftmyfunnel.live/locations',
  },
  openGraph: {
    title: 'Regional Outbound Sales Hubs | CraftMyFunnel',
    description: 'Explore CraftMyFunnel regional B2B outbound hubs across 10 commercial corridors in India.',
    type: 'website',
    url: 'https://craftmyfunnel.live/locations',
  },
};

export default function LocationsIndexPage() {
  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "CraftMyFunnel Regional Outbound Hubs",
    "description": "Directory of commercial and industrial corridors served by CraftMyFunnel governed B2B sales automation.",
    "url": `${siteUrl}/locations`,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": CITIES_MATRIX.map((loc, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": `${siteUrl}/locations/${loc.slug}`,
        "name": `B2B Sales Outreach in ${loc.name}`,
        "description": loc.summary,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 relative z-10 space-y-16">
          {/* Header */}
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              <span>National Coverage — 10 Commercial Engines</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Regional B2B Outbound Sales Hubs
            </h1>
            <p className="text-lg text-slate-300">
              Select your commercial corridor to view hyper-local buyer signal monitoring, sector-specific playbooks, and localized meeting pipeline tracking.
            </p>
          </div>

          {/* 10-City Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CITIES_MATRIX.map((loc) => (
              <Link
                key={loc.slug}
                href={`/locations/${loc.slug}`}
                className="group flex flex-col justify-between p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900/90 transition-all shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {loc.stateCode}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{loc.latitude}°N, {loc.longitude}°E</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {loc.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">{loc.state}, India</p>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {loc.summary}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {loc.corridors.slice(0, 3).map((c, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Explore {loc.name} Corridors</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
