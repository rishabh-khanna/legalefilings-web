import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, excerptFor } from "@/lib/content";
import { GlowBadge } from "@/components/CategoryIcons";
import { SITE_NAME } from "@/config/site";

const ArticleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
  </svg>
);

export const metadata: Metadata = {
  title: `Blog — ${SITE_NAME}`,
  description: "Guides on company registration, compliance, and tax filing in India.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1
        className="text-3xl md:text-4xl font-semibold mb-8"
        style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
      >
        Blog
      </h1>
      <div className="space-y-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="flex items-start gap-4 rounded-2xl border bg-white p-5 transition-[box-shadow,border-color] hover:shadow-md hover:border-[var(--color-accent)] dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <GlowBadge size={48} icon={<ArticleIcon className="h-5 w-5" />} className="shrink-0" />
            <div>
              <h2 className="font-semibold text-lg mb-1.5" style={{ color: "var(--color-ink)" }}>
                {post.title}
              </h2>
              <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                {excerptFor(post)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
