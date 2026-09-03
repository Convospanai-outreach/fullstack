import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Building, ArrowRight, ShieldCheck, CheckCircle2, Users, Target, Phone, Mail } from 'lucide-react';
import { CITIES_MATRIX, getLocationBySlug } from '@/lib/locations';


interface LocationPageProps {
  params: Promise<{
    city: string;
  }>;
}

export function generateStaticParams() {
  return CITIES_MATRIX.map((loc) => ({
    city: loc.slug,
  }));
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const location = getLocationBySlug(resolvedParams.city);

  if (!location) {
    return {
      title: 'Location Not Found',
    };
  }

  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/locations/${location.slug}`;
  const title = `B2B Sales Outreach in ${location.name} | CraftMyFunnel`;
  const description = `Scale B2B meeting pipelines and outbound sales in ${location.name}. Governed AI workflows with human review for ${location.state} enterprise teams.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'CraftMyFunnel AI',
      locale: 'en_IN',
      images: [
        {
          url: '/images/og-branded.png',
          width: 1200,
          height: 630,
          alt: `CraftMyFunnel B2B Outreach in ${location.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/images/og-branded.png'],
    },
    other: {
      'geo.region': location.stateCode,
      'geo.placename': location.placename,
      'geo.position': location.position,
      'ICBM': location.icbm,
    },
  };
}

export default async function LocationCityPage({ params }: LocationPageProps) {
  const resolvedParams = await params;
  const location = getLocationBySlug(resolvedParams.city);

  if (!location) {
    notFound();
  }

  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
  const locationUrl = `${siteUrl}/locations/${location.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": `${locationUrl}#localbusiness`,
        "name": `CraftMyFunnel AI — B2B Outreach & Meeting Pipeline ${location.name}`,
        "url": locationUrl,
        "telephone": "+919711970445",
        "priceRange": "₹₹₹",
        "description": location.summary,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": location.name,
          "addressRegion": location.state,
          "addressCountry": "IN"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": location.latitude,
          "longitude": location.longitude
        },
        "areaServed": [
          { "@type": "City", "name": location.name },
          ...location.corridors.map(c => ({
            "@type": "AdministrativeArea",
            "name": c
          }))
        ]
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${locationUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": siteUrl
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Locations",
            "item": `${siteUrl}/locations`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": location.name,
            "item": locationUrl
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${locationUrl}#faq`,
        "mainEntity": [
          {
            "@type": "Question",
            "name": `How does CraftMyFunnel support B2B outreach in ${location.name}?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `CraftMyFunnel helps enterprise teams in ${location.name} ingest localized buyer intent signals across ${location.corridors.slice(0, 3).join(', ')}, generates compliant multi-touch email drafts, and routes them through a human review approval queue before dispatch.`
            }
          },
          {
            "@type": "Question",
            "name": `What industries benefit most in the ${location.name} corridor?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `In ${location.name}, our vertical playbooks are optimized for ${location.industryFocus.join(', ')}.`
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/3 left-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-20 relative z-10 space-y-24">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/locations" className="hover:text-white transition-colors">Locations</Link>
            <span>/</span>
            <span className="text-white font-medium">{location.name}</span>
          </nav>

          {/* Hero Section */}
          <section className="space-y-6 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              <span>{location.placename} ({location.stateCode})</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              B2B Sales Outreach &amp; Pipeline Engine in{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {location.name}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
              {location.summary} Turn commercial buyer signals into review-ready meetings with human approval controls and deliverability guardrails.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                <span>Start Regional Pilot</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-900 text-slate-200 font-semibold text-sm transition-all flex items-center gap-2"
              >
                <Phone className="w-4 h-4 text-slate-400" />
                <span>Talk to Regional Team</span>
              </Link>
            </div>
          </section>

          {/* Regional Corridors Architecture Visual */}
          <div className="rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/40 p-2 sm:p-4 shadow-2xl">
            <Image
              src="/images/platform/regional-corridors.webp"
              alt={`${location.name} Commercial Corridors and Governed B2B Outbound Map`}
              width={820}
              height={460}
              priority
              className="w-full h-auto rounded-2xl"
            />
          </div>

          {/* Key Business Corridors */}
          <section className="space-y-8">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <span>Active Commercial &amp; Industrial Corridors in {location.name}</span>
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Hyper-local signal coverage and account tracking across major commercial clusters.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {location.corridors.map((corridor, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 transition-all space-y-2"
                >
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Cluster {idx + 1}</div>
                  <h3 className="text-lg font-bold text-white">{corridor}</h3>
                  <p className="text-xs text-slate-400">
                    Targeted buyer signal monitoring, office expansion alerts, and procurement tracking.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Industry Focus */}
          <section className="p-8 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950 border border-slate-800 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              <span>Target Sectors &amp; Vertical Playbooks</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {location.industryFocus.map((ind, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">{ind}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Custom intent triggers, decision-maker filters, and governed email templates.</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Deliverability & Compliance Guardrails */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Deliverability Guardrails</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                RFC 5322 Message-ID compliance, Gmail/Google Workspace domain safety, and automatic warmup protection.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h3 className="text-base font-bold text-white">Human Approval Queue</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every outreach email is generated with verified context and awaits explicit one-click operator approval before send.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <Target className="w-6 h-6 text-purple-400" />
              <h3 className="text-base font-bold text-white">Meeting Attribution</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track positive reply sentiment, meeting bookings, and pipeline velocity directly to your regional revenue targets.
              </p>
            </div>
          </section>

          {/* Regional Hub Navigation */}
          <section className="pt-12 border-t border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white">Explore Other Regional Outbound Hubs</h2>
            <div className="flex flex-wrap gap-2">
              {CITIES_MATRIX.map((c) => (
                <Link
                  key={c.slug}
                  href={`/locations/${c.slug}`}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    c.slug === location.slug
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
