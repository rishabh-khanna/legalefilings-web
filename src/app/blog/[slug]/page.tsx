import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPost, getAllPosts, excerptFor } from "@/lib/content";
import { ContentBlocks } from "@/components/ContentBlocks";
import { SITE_NAME } from "@/config/site";

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — ${SITE_NAME}`,
    description: excerptFor(post),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/blog" className="text-sm hover:text-[var(--color-action)]" style={{ color: "var(--color-ink-soft)" }}>
        ← Back to Blog
      </Link>
      <h1
        className="text-3xl md:text-4xl font-semibold mt-3"
        style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
      >
        {post.title}
      </h1>
      <span aria-hidden="true" className="mt-3 mb-8 block h-1 w-14 rounded-full" style={{ backgroundColor: "var(--color-accent)" }} />
      <ContentBlocks blocks={post.blocks} />
    </div>
  );
}
