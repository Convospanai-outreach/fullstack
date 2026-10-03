import { getBlogPostBySlug, getBlogPosts } from '@/lib/blog';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate static params for SEO/performance
export function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const post = getBlogPostBySlug(resolvedParams.slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/blog/${resolvedParams.slug}`;

  return {
    title: `${post.title} | CraftMyFunnel AI Blog`,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      url: canonicalUrl,
      authors: ['CraftMyFunnel Editorial Team'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  const post = getBlogPostBySlug(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
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
            "name": "Blog",
            "item": `${siteUrl}/blog`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": post.title,
            "item": postUrl
          }
        ]
      },
      {
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.description,
        "datePublished": post.date,
        "dateModified": post.date,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": postUrl,
        },
        "author": {
          "@type": "Organization",
          "name": "CraftMyFunnel Editorial Team",
          "url": siteUrl,
        },
        "publisher": {
          "@type": "Organization",
          "name": "CraftMyFunnel",
          "url": siteUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${siteUrl}/favicon.ico`,
          },
        },
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="container mx-auto px-4 pt-6 pb-16 max-w-4xl">
        <Link href="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-foreground">
            {post.title}
          </h1>
          <div className="flex items-center space-x-4 text-muted-foreground border-b pb-8">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span>&bull;</span>
            <span>6 min read</span>
            <span>&bull;</span>
            <span className="text-primary font-medium">Verified AI Guide</span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        {/* Related Product Solutions Cross-Links for SEO & Internal Equity */}
        <div className="mt-16 pt-10 border-t border-slate-800">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Explore Governed Outreach Solutions</h3>
            <p className="text-sm text-muted-foreground">Discover dedicated systems designed for signal capture, AI personalization, and deliverability control.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/products/fluid-funnel-engine" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-blue-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-blue-400 text-sm mb-1">Fluid Funnel Engine &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Adaptive multi-stage sequence routing that shifts cadences based on prospect engagement.</p>
            </Link>
            <Link href="/products/buyer-signals" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-emerald-400 text-sm mb-1">Buyer Signals — NetJana &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Zero-latency intent capture across job postings, executive moves, and tech migrations.</p>
            </Link>
            <Link href="/products/ai-outreach" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-purple-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-purple-400 text-sm mb-1">AI Outreach — CMF Core &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Multi-model draft generation with strict prompt guardrails and deliverability headers.</p>
            </Link>
            <Link href="/products/human-layer" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-amber-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-amber-400 text-sm mb-1">Human Layer &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Mandatory human review and batch approval queue to ensure 100% brand voice alignment.</p>
            </Link>
            <Link href="/products/covospan-edge" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-cyan-400 text-sm mb-1">Covospan EDGE &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Sub-100ms inference runtime for local tenant data isolation and zero external leakage.</p>
            </Link>
            <Link href="/use-cases" className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-indigo-500/40 hover:bg-slate-900 transition-all group">
              <div className="font-semibold text-foreground group-hover:text-indigo-400 text-sm mb-1">Vertical Playbooks &rarr;</div>
              <p className="text-xs text-muted-foreground line-clamp-2">Pre-engineered outbound playbooks for SaaS, staffing, consulting, IT MSPs, and FM.</p>
            </Link>
          </div>
        </div>

        {/* In-Article Conversion & Backlink Box */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/20 text-center space-y-4">
          <h3 className="text-2xl font-bold text-white">Scale Your Outbound with Governed AI Agents</h3>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Put these AI sales strategies into production with built-in human-in-the-loop review queues, mailbox deliverability protection, and multi-channel workflow automation.
          </p>
          <div className="pt-2 flex justify-center gap-4">
            <Link href="/signup" className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20">
              Start Pilot &rarr;
            </Link>
            <Link href="/pricing" className="px-6 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition-all">
              View Pricing
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
