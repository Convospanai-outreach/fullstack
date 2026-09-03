import { getBlogPosts } from '@/lib/blog';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Agent & LLM Automation Blog | CraftMyFunnel',
  description: 'Learn how to leverage AI agents, LLMs, and automation for outreach, pipeline generation, and scaling your business. Insights and tutorials for AI-driven growth.',
  openGraph: {
    title: 'AI Agent & LLM Automation Blog | CraftMyFunnel',
    description: 'Learn how to leverage AI agents, LLMs, and automation for outreach, pipeline generation, and scaling your business.',
    type: 'website',
  },
};

export default function BlogIndex() {
  const posts = getBlogPosts();
  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "The AI Agent & LLM Automation Blog",
    "description": "Deep dives into AI automation, LLM workflows, and building autonomous systems for revenue growth.",
    "url": `${siteUrl}/blog`,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": posts.map((post, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": `${siteUrl}/blog/${post.slug}`,
        "name": post.title,
        "description": post.description,
      })),
    },
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-16 max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
          The AI Agent & LLM Blog
        </h1>
        <p className="text-xl text-muted-foreground">
          Deep dives into AI automation, LLM workflows, and building autonomous systems for revenue growth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Link href={`/blog/${post.slug}`} key={post.slug} className="group flex flex-col space-y-3 block border rounded-xl p-6 transition-all hover:shadow-lg hover:border-primary/50 bg-card">
            <p className="text-sm text-muted-foreground">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h2 className="text-2xl font-bold group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h2>
            <p className="text-muted-foreground line-clamp-3">
              {post.description}
            </p>
            <div className="pt-4 mt-auto">
              <span className="text-primary font-medium text-sm group-hover:underline">
                Read Article &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
      
      {posts.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg">No posts available yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
